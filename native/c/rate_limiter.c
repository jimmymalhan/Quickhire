#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <string.h>
#include <unistd.h>

#define MAX_SOURCES 8
#define BUCKET_CAP  100

typedef struct {
    char   source[32];
    double tokens;
    double rate_per_sec;   // tokens added per second
    double cap;
    long   last_refill_ns;
} TokenBucket;

static long now_ns() {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1000000000L + ts.tv_nsec;
}

static void refill(TokenBucket *b) {
    long now = now_ns();
    double elapsed = (now - b->last_refill_ns) / 1e9;
    b->tokens += elapsed * b->rate_per_sec;
    if (b->tokens > b->cap) b->tokens = b->cap;
    b->last_refill_ns = now;
}

static int try_consume(TokenBucket *b, double cost) {
    refill(b);
    if (b->tokens >= cost) { b->tokens -= cost; return 1; }
    return 0;
}

int main(int argc, char *argv[]) {
    const char *state_dir = argc > 1 ? argv[1] : "state/local-agent-runtime";

    TokenBucket buckets[MAX_SOURCES] = {
        {"LinkedIn",   50.0, 0.5, 50.0, now_ns()},  // 0.5 req/sec = 30 req/min
        {"Indeed",     80.0, 1.0, 80.0, now_ns()},  // 1 req/sec
        {"Glassdoor",  40.0, 0.3, 40.0, now_ns()},  // 0.3 req/sec
        {"Dice",       60.0, 0.8, 60.0, now_ns()},
        {"Wellfound",  70.0, 1.2, 70.0, now_ns()},
    };
    int n = 5;

    // Write status JSON
    char path[256];
    snprintf(path, sizeof(path), "%s/rate-limit-status.json", state_dir);
    FILE *f = fopen(path, "w");
    if (!f) { fprintf(stderr, "cannot open %s\n", path); return 1; }

    fprintf(f, "{\n  \"sources\": [\n");
    for (int i = 0; i < n; i++) {
        refill(&buckets[i]);
        double pct = buckets[i].tokens / buckets[i].cap * 100.0;
        fprintf(f, "    {\"source\":\"%s\",\"tokens\":%.1f,\"cap\":%.0f,"
                   "\"rate_per_sec\":%.1f,\"pct_available\":%.1f}%s\n",
                buckets[i].source, buckets[i].tokens, buckets[i].cap,
                buckets[i].rate_per_sec, pct, i < n-1 ? "," : "");
        printf("[RATE-LIMITER] %-12s tokens=%.1f/%.0f (%.0f%%)\n",
               buckets[i].source, buckets[i].tokens, buckets[i].cap, pct);
    }
    fprintf(f, "  ]\n}\n");
    fclose(f);
    printf("[RATE-LIMITER] Status written to %s\n", path);
    return 0;
}
