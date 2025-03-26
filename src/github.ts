import { Octokit } from "octokit";
import { Resume, sampleResume } from "./types.js";

export class GitHubService {
  private octokit: Octokit;
  private username: string;
  private cachedGistId: string | null = null;

  constructor(token: string, username: string) {
    if (!token) {
      throw new Error("GitHub token is required");
    }
    if (!username) {
      throw new Error("GitHub username is required");
    }

    this.octokit = new Octokit({ auth: token });
    this.username = username;
  }

  /**
   * Fetch user profile information from GitHub
   */
  async getUserProfile() {
    try {
      const { data } = await this.octokit.rest.users.getByUsername({
        username: this.username,
      });
      return data;
    } catch (error) {
      console.log("Error fetching user profile:", error);
      throw error;
    }
  }

  /**
   * Get resume.json from user's gists
   */
  async getResumeFromGists(): Promise<Resume | null> {
    try {
      // If we've already found the gist ID in this session, use it
      if (this.cachedGistId) {
        console.log(`Using cached gist ID: ${this.cachedGistId}`);
        try {
          const { data: gist } = await this.octokit.rest.gists.get({
            gist_id: this.cachedGistId,
          });

          const files = gist.files || {};
          const resumeFile = Object.values(files).find(
            (file) => file?.filename === "resume.json"
          );

          if (resumeFile && resumeFile.raw_url) {
            const response = await fetch(resumeFile.raw_url);
            const resumeData = await response.json();
            console.log("Successfully fetched resume from cached gist ID");
            return {
              ...resumeData,
              _gistId: this.cachedGistId
            };
          }
        } catch (error) {
          console.log("Error fetching from cached gist ID, will try listing all gists:", error);
          this.cachedGistId = null;
        }
      }

      // List all gists for the user
      console.log(`Listing gists for user: ${this.username}`);
      const { data: gists } = await this.octokit.rest.gists.list({
        username: this.username,
        per_page: 100,
      });

      console.log(`Found ${gists.length} gists, searching for resume.json`);

      // Find all gists containing resume.json and sort by updated_at
      const resumeGists = gists
        .filter(gist => {
          const files = gist.files || {};
          return Object.values(files).some(
            (file) => file?.filename === "resume.json"
          );
        })
        .sort((a, b) => {
          // Sort by updated_at in descending order (newest first)
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });

      if (!resumeGists.length) {
        console.log("No resume.json found in any gists");
        return null;
      }

      const mostRecentGist = resumeGists[0];
      if (!mostRecentGist || !mostRecentGist.id) {
        console.log("Invalid gist found: missing or invalid ID");
        return null;
      }

      // At this point TypeScript knows id exists and is a string
      const gistId: string = mostRecentGist.id;
      if (!gistId) {
        console.log("Invalid gist found: missing or invalid ID");
        return null;
      }
      console.log(`Found ${resumeGists.length} resume.json gists. Using most recent: ${gistId} (updated: ${mostRecentGist.updated_at})`);

      // Cache the gist ID for future use
      this.cachedGistId = gistId;

      const files = mostRecentGist.files || {};
      const resumeFile = Object.values(files).find(
        (file) => file?.filename === "resume.json"
      );

      if (resumeFile && resumeFile.raw_url) {
        // Fetch the content of resume.json
        const response = await fetch(resumeFile.raw_url);
        const resumeData = await response.json();
        return {
          ...resumeData,
          _gistId: gistId
        };
      }

      console.log("No resume.json found in any gists");
      return null;
    } catch (error) {
      console.log("Error fetching resume from gists:", error);
      throw error;
    }
  }

  /**
   * Create a sample resume.json gist if none exists
   */
  async createSampleResume(): Promise<Resume> {
    try {
      // Get user profile to populate some basic fields
      const userProfile = await this.getUserProfile();

      // Create a copy of the sample resume and populate with GitHub profile info
      const newResume = JSON.parse(JSON.stringify(sampleResume)) as Resume;

      if (newResume.basics) {
        newResume.basics.name = userProfile.name || this.username;

        if (newResume.basics.profiles) {
          const githubProfile = newResume.basics.profiles.find(p => p.network === "GitHub");
          if (githubProfile) {
            githubProfile.username = this.username;
            githubProfile.url = `https://github.com/${this.username}`;
          }
        }

        newResume.basics.email = userProfile.email || "";
      }

      console.log("Creating new gist with resume.json");
      // Create a new gist with resume.json
      const { data: gist } = await this.octokit.rest.gists.create({
        files: {
          "resume.json": {
            content: JSON.stringify(newResume, null, 2),
          },
        },
        description: "My JSON Resume",
        public: true,
      });

      // Cache the gist ID for future use
      this.cachedGistId = gist.id;
      console.log(`Created new gist with ID: ${gist.id}`);

      return {
        ...newResume,
        _gistId: gist.id
      };
    } catch (error) {
      console.log("Error creating sample resume:", error);
      throw error;
    }
  }

  /**
   * Create a new gist with a timestamped version of the resume
   */
  async createUpdatedResumeGist(resume: Resume): Promise<Resume> {
    try {
      // Generate timestamped filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '');
      const filename = `updated_resume_${timestamp}.json`;

      // Create clean copy without _gistId
      const { _gistId, ...resumeData } = { ...resume, _gistId: undefined };

      // Update lastModified date
      if (resumeData.meta) {
        resumeData.meta.lastModified = new Date().toISOString();
      } else {
        resumeData.meta = {
          lastModified: new Date().toISOString()
        };
      }

      console.log(`Creating new resume gist: ${filename}`);
      // Create new gist with timestamped filename
      const { data: newGist } = await this.octokit.rest.gists.create({
        files: {
          [filename]: {
            content: JSON.stringify(resumeData, null, 2),
          },
        },
        description: `Updated resume - ${timestamp}`,
        public: true,
      });

      return {
        ...resumeData,
        _gistId: newGist.id
      };
    } catch (error) {
      console.log("Error creating updated resume gist:", error);
      throw error;
    }
  }

  /**
   * Get user's repositories and their contributions
   */
  async getUserRepositories() {
    try {
      // Get user's repositories
      const { data: repos } = await this.octokit.rest.repos.listForUser({
        username: this.username,
        sort: "updated",
        per_page: 10, // Limit to recent 10 repos
      });

      return repos;
    } catch (error) {
      console.log("Error fetching user repositories:", error);
      throw error;
    }
  }

  /**
   * Get user's contributions to a specific repository
   */
  async getRepoContributions(owner: string, repo: string) {
    try {
      // Get user's commits to the repository
      const { data: commits } = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        author: this.username,
        per_page: 20,
      });

      return commits;
    } catch (error) {
      console.log(`Error fetching contributions to ${owner}/${repo}:`, error);
      return []; // Return empty array on error
    }
  }
}
