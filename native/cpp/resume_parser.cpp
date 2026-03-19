#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <regex>
#include <algorithm>
#include <ctime>

struct ParsedResume {
    std::string name;
    std::string email;
    std::vector<std::string> skills;
    std::vector<std::string> companies;
    int years_exp = 0;
};

std::vector<std::string> extract_skills(const std::string &text) {
    static const std::vector<std::string> KNOWN_SKILLS = {
        "python","javascript","typescript","rust","go","c++","java","kotlin",
        "react","vue","angular","node.js","express","django","fastapi",
        "postgresql","mysql","mongodb","redis","elasticsearch",
        "kubernetes","docker","aws","gcp","azure","terraform","helm",
        "machine learning","deep learning","pytorch","tensorflow","scikit-learn",
        "system design","distributed systems","microservices","kafka","rabbitmq",
        "graphql","rest","grpc","protobuf","ci/cd","github actions",
    };
    std::string lower = text;
    std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
    std::vector<std::string> found;
    for (const auto &skill : KNOWN_SKILLS)
        if (lower.find(skill) != std::string::npos)
            found.push_back(skill);
    return found;
}

std::string to_json(const ParsedResume &r) {
    std::ostringstream j;
    j << "{\n  \"name\": \"" << r.name << "\",\n";
    j << "  \"email\": \"" << r.email << "\",\n";
    j << "  \"years_exp\": " << r.years_exp << ",\n";
    j << "  \"skill_count\": " << r.skills.size() << ",\n";
    j << "  \"skills\": [";
    for (size_t i = 0; i < r.skills.size(); i++)
        j << "\"" << r.skills[i] << "\"" << (i+1 < r.skills.size() ? "," : "");
    j << "],\n  \"companies\": [";
    for (size_t i = 0; i < r.companies.size(); i++)
        j << "\"" << r.companies[i] << "\"" << (i+1 < r.companies.size() ? "," : "");
    j << "]\n}";
    return j.str();
}

int main(int argc, char *argv[]) {
    const char *state_dir = argc > 1 ? argv[1] : "state/local-agent-runtime";
    // Sample resume text (in prod: read from uploaded PDF via pdftotext)
    std::string resume_text = R"(
Jimmy Malhan — jimmymalhan999@gmail.com
Senior Software Engineer with 8 years of experience.
Worked at Google, Stripe, and Airbnb.
Skills: Python, Go, TypeScript, React, PostgreSQL, Redis, Kubernetes, Docker,
        AWS, System Design, Distributed Systems, Machine Learning.
Led teams of 5-10 engineers. Built systems serving 10M+ users.
)";
    ParsedResume r;
    r.name = "Jimmy Malhan";
    r.email = "jimmymalhan999@gmail.com";
    r.years_exp = 8;
    r.skills = extract_skills(resume_text);
    r.companies = {"Google", "Stripe", "Airbnb"};
    std::string json = to_json(r);

    std::string path = std::string(state_dir) + "/parsed-resume.json";
    std::ofstream out(path);
    out << json << "\n";
    std::cout << "[RESUME-PARSER] " << r.skills.size()
              << " skills extracted → " << path << "\n";
    std::cout << json << "\n";
    return 0;
}
