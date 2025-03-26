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
   * Get the content of resume.json from the most recent user gist containing it.
   * Returns the file content as a string, or null if not found.
   */
  async getResumeGist(): Promise<string | null> {
    try {
      let gistIdToFetch: string | null = this.cachedGistId;

      // If not cached, find the most recent gist containing resume.json
      if (!gistIdToFetch) {
        console.log(`Listing gists for user: ${this.username} to find resume.json`);
        const { data: gists } = await this.octokit.rest.gists.list({
          username: this.username,
          per_page: 100, // Check up to 100 gists
        });
        console.log(`Found ${gists.length} gists.`);

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
          console.log("No gist containing resume.json found.");
          return null;
        }

        const mostRecentGist = resumeGists[0];
        if (!mostRecentGist || !mostRecentGist.id) {
          console.error("Found resume gist but it has an invalid ID.");
          return null;
        }

        gistIdToFetch = mostRecentGist.id;
        this.cachedGistId = gistIdToFetch; // Cache the found ID
        console.log(`Found most recent resume.json in gist ID: ${gistIdToFetch} (updated: ${mostRecentGist.updated_at}). Caching ID.`);
      } else {
        console.log(`Using cached gist ID: ${gistIdToFetch}`);
      }

      // Fetch the specific gist using the determined ID
      try {
        console.log(`Fetching content of gist ID: ${gistIdToFetch}`);
        const { data: gist } = await this.octokit.rest.gists.get({
          gist_id: gistIdToFetch,
        });

        const files = gist.files || {};
        const resumeFile = files['resume.json']; // Direct access by filename

        if (resumeFile && typeof resumeFile.content === 'string') {
          console.log("Successfully fetched resume.json content.");
          return resumeFile.content;
        } else {
          console.error(`Gist ${gistIdToFetch} found, but resume.json file or its content is missing.`);
          // If the cached ID failed, clear it and maybe retry listing? For now, just return null.
          if (this.cachedGistId === gistIdToFetch) {
            this.cachedGistId = null;
            console.log("Cleared cached gist ID due to fetch failure.");
          }
          return null;
        }
      } catch (error) {
        console.error(`Error fetching gist content for ID ${gistIdToFetch}:`, error);
        // If the cached ID caused the error, clear it
        if (this.cachedGistId === gistIdToFetch) {
          this.cachedGistId = null;
          console.log("Cleared cached gist ID due to fetch error.");
        }
        throw error; // Re-throw after logging and potentially clearing cache
      }

    } catch (error) {
      console.error("Error in getResumeGist:", error);
      // Don't throw here, return null as per Promise<string | null>
      return null;
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
        public: true, // Note: Plan asks for *updated* resume to be secret, sample can be public
      });

      // Ensure gist.id is valid before using it
      if (!gist.id) {
        throw new Error("Failed to create gist: No ID returned.");
      }

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
   * Create a new secret gist with the provided content.
   * Implements step 2 of the plan.
   * @param content The JSON string content for the new gist file.
   * @returns The URL of the newly created gist.
   */
  async createResumeGist(content: string): Promise<string> {
    try {
      // Generate timestamped filename
      const filename = `updated_resume_${Date.now()}.json`;

      console.log(`Creating new secret resume gist: ${filename}`);
      // Create new gist with timestamped filename
      const { data: newGist } = await this.octokit.rest.gists.create({
        files: {
          [filename]: {
            content: content, // Use the provided content string directly
          },
        },
        description: 'Updated Resume generated by MCP',
        public: false, // Make the gist secret as per plan
      });

      if (!newGist.html_url) {
         throw new Error("Failed to create gist: No html_url returned.");
      }

      console.log(`Created new secret gist: ${newGist.html_url}`);
      return newGist.html_url; // Return the URL as per plan

    } catch (error) {
      console.error("Error creating updated resume gist:", error);
      throw error; // Re-throw the error to be handled by the caller
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
