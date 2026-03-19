use std::collections::HashMap;
use std::fs;
use std::time::Instant;
use serde_json::{json, Value};

fn match_score(job_title: &str, job_skills: &[&str], resume_skills: &[&str]) -> f64 {
    let title_lower = job_title.to_lowercase();
    let title_bonus = if title_lower.contains("senior") || title_lower.contains("staff") { 10.0 }
                      else if title_lower.contains("principal") { 15.0 } else { 0.0 };
    let skill_matches = resume_skills.iter()
        .filter(|s| job_skills.contains(s))
        .count();
    let base = (skill_matches as f64 / job_skills.len().max(1) as f64) * 75.0;
    (base + title_bonus).min(99.0)
}

fn main() {
    let state_dir = std::env::var("STATE_DIR")
        .unwrap_or_else(|_| "state/local-agent-runtime".to_string());
    let start = Instant::now();

    // Resume skills (would load from profile in prod)
    let resume_skills = vec![
        "rust","go","python","typescript","react","postgresql","redis",
        "kubernetes","docker","aws","system-design","distributed-systems",
    ];

    // Sample job pool (would load from scraped-jobs.json in prod)
    let jobs = vec![
        ("Senior Rust Engineer", vec!["rust","systems","performance","concurrency"]),
        ("Staff Platform Engineer", vec!["go","kubernetes","docker","aws","terraform"]),
        ("Principal Backend Engineer", vec!["python","postgresql","redis","system-design"]),
        ("Full Stack Engineer", vec!["react","typescript","postgresql","aws"]),
        ("SRE / DevOps", vec!["kubernetes","docker","prometheus","grafana","aws"]),
        ("ML Infrastructure Engineer", vec!["python","distributed-systems","aws","rust"]),
    ];

    let mut results: Vec<Value> = jobs.iter()
        .map(|(title, skills)| {
            let score = match_score(title, skills, &resume_skills);
            json!({"title": title, "match_score": score,
                   "matched_skills": skills.iter().filter(|s| resume_skills.contains(s)).collect::<Vec<_>>()})
        })
        .collect();

    // Sort by match score descending
    results.sort_by(|a, b| {
        b["match_score"].as_f64().unwrap_or(0.0)
            .partial_cmp(&a["match_score"].as_f64().unwrap_or(0.0))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let output = json!({
        "computed_at": chrono_now(),
        "elapsed_ms": start.elapsed().as_millis(),
        "results": results,
        "top_match": results.first().cloned().unwrap_or(json!({})),
    });

    let path = format!("{}/match-scores.json", state_dir);
    fs::write(&path, serde_json::to_string_pretty(&output).unwrap()).ok();
    println!("[RUST-MATCHER] {} jobs scored in {}μs → {}",
        results.len(), start.elapsed().as_micros(), path);
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    format!("{}Z", secs)
}
