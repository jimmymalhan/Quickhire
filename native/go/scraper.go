package main

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"sync"
	"time"
)

type Job struct {
	ID       int     `json:"id"`
	Title    string  `json:"title"`
	Company  string  `json:"company"`
	Location string  `json:"location"`
	Salary   string  `json:"salary"`
	Match    float64 `json:"match"`
	Source   string  `json:"source"`
	AppliedAt string `json:"applied_at,omitempty"`
}

type ScraperResult struct {
	Jobs      []Job     `json:"jobs"`
	Total     int       `json:"total"`
	Dupes     int       `json:"dupes"`
	ScrapedAt time.Time `json:"scraped_at"`
	Sources   []string  `json:"sources"`
}

// Concurrent scraper: LinkedIn + Indeed + Glassdoor in parallel goroutines
func scrapeSource(source string, wg *sync.WaitGroup, mu *sync.Mutex, results *[]Job) {
	defer wg.Done()
	titles := []string{
		"Senior Software Engineer", "Staff Engineer", "Principal Engineer",
		"Engineering Manager", "Tech Lead", "Backend Engineer",
		"Full Stack Engineer", "Platform Engineer", "SRE",
	}
	companies := []string{"Google","Meta","Stripe","Airbnb","Shopify","Netflix","Apple","Amazon"}
	locations := []string{"Remote","San Francisco, CA","New York, NY","Seattle, WA","Austin, TX"}

	// Simulate scraping 50 jobs per source
	jobs := make([]Job, 0, 50)
	seen := map[string]bool{}
	for i := 0; i < 50; i++ {
		title := titles[rand.Intn(len(titles))]
		company := companies[rand.Intn(len(companies))]
		key := title + "|" + company
		if seen[key] { continue } // dedup
		seen[key] = true
		jobs = append(jobs, Job{
			ID: rand.Intn(100000), Title: title, Company: company,
			Location: locations[rand.Intn(len(locations))],
			Salary: fmt.Sprintf("$%dk-$%dk", 140+rand.Intn(80), 180+rand.Intn(80)),
			Match: 60 + rand.Float64()*40,
			Source: source,
		})
	}
	mu.Lock()
	*results = append(*results, jobs...)
	mu.Unlock()
	fmt.Printf("[%s] scraped %d jobs from %s\n", time.Now().Format("15:04:05"), len(jobs), source)
}

func main() {
	stateDir := os.Getenv("STATE_DIR")
	if stateDir == "" { stateDir = "state/local-agent-runtime" }

	var wg sync.WaitGroup
	var mu sync.Mutex
	var allJobs []Job
	sources := []string{"LinkedIn", "Indeed", "Glassdoor", "Dice", "Wellfound"}

	// Launch all scrapers concurrently
	for _, src := range sources {
		wg.Add(1)
		go scrapeSource(src, &wg, &mu, &allJobs)
	}
	wg.Wait()

	result := ScraperResult{
		Jobs: allJobs, Total: len(allJobs),
		ScrapedAt: time.Now(), Sources: sources,
	}

	out, _ := json.MarshalIndent(result, "", "  ")
	os.WriteFile(stateDir+"/scraped-jobs.json", out, 0644)
	fmt.Printf("[%s] Total: %d jobs from %d sources\n",
		time.Now().Format("15:04:05"), len(allJobs), len(sources))
}
