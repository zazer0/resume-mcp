import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { readFile } from 'fs/promises';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { GitHubService } from "./src/github.js";
import { OpenAIService } from "./src/openai.js";
import { Resume } from "./src/types.js";
import { CodebaseAnalyzer } from "./src/codebase.js";
import { ResumeEnhancer } from "./src/resume-enhancer.js";
import fs from 'fs'; // Import fs for sync file reading if needed, or use async readFile
import path from 'path'; // Import path for resolving paths if needed

const server = new Server(
  {
    name: "jsonresume-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      logging: {},
    },
  }
);

// Environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;

// Initialize services
let githubService: GitHubService;
let openaiService: OpenAIService;
let codebaseAnalyzer: CodebaseAnalyzer;
let resumeEnhancer: ResumeEnhancer;

try {
  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }
  if (!GITHUB_USERNAME) {
    throw new Error("GITHUB_USERNAME environment variable is required");
  }

  githubService = new GitHubService(GITHUB_TOKEN, GITHUB_USERNAME);
  openaiService = new OpenAIService(OPENAI_API_KEY);
  codebaseAnalyzer = new CodebaseAnalyzer(process.cwd());
  // Assuming ResumeEnhancer needs OpenAIService based on plan step 4
  resumeEnhancer = new ResumeEnhancer(openaiService);

  console.log("Services initialized successfully");
} catch (error) {
  console.error("Error initializing services:", error);
  process.exit(1);
}

// Define MCP tools
const ANALYZE_CODEBASE_TOOL: Tool = {
  name: "github_analyze_codebase",
  description: "This is a tool from the github MCP server.\nAnalyzes the current codebase and returns information about technologies, languages, and recent commits",
  inputSchema: {
    type: "object",
    properties: {
      directory: {
        type: "string",
        description: "The directory to analyze. If not provided, uses current working directory.",
      },
    },
    required: [],
  },
};

const CHECK_RESUME_TOOL: Tool = {
  name: "github_check_resume",
  description: "This is a tool from the github MCP server.\nChecks if a GitHub user has a JSON Resume and returns its information",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

const ENHANCE_RESUME_WITH_PROJECT_TOOL: Tool = {
  name: "github_enhance_resume_with_project",
  description: "This is a tool from the github MCP server.\nEnhances a GitHub user's JSON Resume with information about their current project",
  inputSchema: {
    type: "object",
    properties: {
      directory: {
        type: "string",
        description: "The directory of the project to analyze. If not provided, uses current working directory.",
      },
    },
    required: [],
  },
};

// Updated tool definition based on plan step 5
const ENHANCE_RESUME_TOOL: Tool = {
  name: "enhance_resume", // Renamed as per plan step 5
  description: "Enhances a resume based on a job description JSON file and creates a new secret gist.",
  inputSchema: {
    type: "object",
    properties: {
      job_json_path: { // Changed input name as per plan step 5
        type: "string",
        description: "Path to the job description file in JSON format",
      },
    },
    required: ["job_json_path"],
  },
};

const tools = [
  CHECK_RESUME_TOOL,
  ENHANCE_RESUME_TOOL, // Use the updated tool definition
  ENHANCE_RESUME_WITH_PROJECT_TOOL, // Keep this for now, though not in the plan's final workflow
  ANALYZE_CODEBASE_TOOL,
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// This function seems unused based on the tool definitions
// function doHello(name: string) {
//   return {
//     message: `Hello, ${name}!`,
//   };
// }

async function analyzeCodebase(directory?: string) {
  try {
    console.log("Starting codebase analysis...");

    // Create a new analyzer for the specified directory
    const analyzer = directory ? new CodebaseAnalyzer(directory) : codebaseAnalyzer;

    // Analyze the codebase
    const analysis = await analyzer.analyze();

    console.log("Codebase analysis completed");

    return { // Wrap successful response in content array
      content: [{
        type: 'json',
        json: {
          message: "Codebase analysis completed successfully",
          analysis,
          summary: analysis.summary
        }
      }]
    };
  } catch (error) {
    console.error("Error analyzing codebase:", error);
    // Return an error structure suitable for MCP, also wrapped in content array
    return {
      content: [{
        type: 'text',
        text: `Error analyzing codebase: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      }],
    };
  }
}

async function checkResume() {
  try {
    console.log("Checking for existing resume...");

    // Fetch the user's resume content from GitHub gists
    const resumeContent = await githubService.getResumeGist();
    console.log("Raw resumeContent from githubService.getResumeGist:", resumeContent);

    if (!resumeContent) {
      return { // Wrap "no resume found" response in content array
        content: [{
          type: 'text',
          text: "No resume.json found in user's gists",
          isError: false, // Or true, depending on how "not found" should be treated
        }],
      };
    }

    try {
      // Parse the resume content
      const resume: Resume = JSON.parse(resumeContent);
      // Remove the _gistId property if it exists (though getResumeGist shouldn't add it)
      const { _gistId, ...cleanResume } = resume;

      return { // Wrap successful response in content array
        content: [{
          type: 'json',
          json: cleanResume,
        }],
      };
    } catch (parseError: any) { // Explicitly type parseError
      console.error("Error parsing resume.json content:", parseError);
      return { // Wrap error in content array
        content: [{
          type: 'text',
          text: `Found resume.json, but failed to parse its content: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          isError: true,
        }],
      };
    }

  } catch (error) {
    console.error("Error checking resume:", error);
    if (error instanceof McpError) throw error;
    return { // Wrap error in content array
      content: [{
        type: 'text',
        text: `Error checking resume: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      }],
    };
  }
}

// Refactored function based on implementation plan step 5
async function enhanceResume(job_json_path: string) {
  try {
    console.log(`Starting resume enhancement using job description: ${job_json_path}`);

    // Step 1: Read the job description file
    let jobDetails: object;
    try {
      // Use fs.readFileSync for simplicity as per plan, ensure path is correct
      const jobDescContent = fs.readFileSync(job_json_path, 'utf-8');
      jobDetails = JSON.parse(jobDescContent);
      console.log("Successfully read and parsed job description.");
    } catch (error) {
      console.error(`Error reading or parsing job description file at ${job_json_path}:`, error);
      throw new McpError(ErrorCode.InvalidParams, `Failed to read or parse job description file: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 2: Get current resume content
    console.log("Fetching current resume content from GitHub gist...");
    const currentResumeContent = await githubService.getResumeGist();

    if (!currentResumeContent) {
      console.error("No resume.json found in user's gists. Cannot enhance.");
      // Use InvalidRequest as NotFound is not available
      throw new McpError(ErrorCode.InvalidRequest, "No resume.json found in your gists. Please create one first.");
    }
    console.log("Successfully fetched current resume content.");

    // Step 3: Enhance the resume using ResumeEnhancer
    console.log("Calling OpenAI service via ResumeEnhancer to adjust resume...");
    // Assuming resumeEnhancer.enhance exists as per plan step 4 - This will be implemented next.
    const enhancedResumeContent = await resumeEnhancer.enhance(currentResumeContent, jobDetails);
    console.log("Successfully received enhanced resume content.");

    // Step 4: Create a new secret gist with the enhanced content
    console.log("Creating new secret gist with enhanced resume...");
    // Assuming githubService.createResumeGist exists as per plan step 2
    const newGistUrl = await githubService.createResumeGist(enhancedResumeContent);
    console.log(`Successfully created new gist: ${newGistUrl}`);

    // Step 5: Return the URL of the new gist
    return { // Wrap successful response in content array
      content: [{
        type: 'json',
        json: {
          message: "Resume successfully enhanced and saved to a new secret gist.",
          gistUrl: newGistUrl
        }
      }]
    };

  } catch (error) {
    console.error("Error in enhanceResume tool:", error);
    if (error instanceof McpError) throw error; // Re-throw known MCP errors
    // Wrap other errors and return in content array
    return {
      content: [{
        type: 'text',
        text: `Failed to enhance resume: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      }],
    };
  }
}


async function enhanceResumeWithProject(directory?: string) {
  try {
    console.log("Starting resume enhancement with current project...");

    // Step 1: Fetch the user's resume content from GitHub gists
    console.log("Fetching resume content from GitHub gists...");
    const resumeContent = await githubService.getResumeGist(); // Changed function call

    let resume: Resume;
    if (!resumeContent) {
      // If no resume exists, create a sample one
      console.log("No resume found, creating a sample resume...");
      // createSampleResume returns a Resume object directly
      resume = await githubService.createSampleResume();
      console.log("Sample resume created successfully");
    } else {
       try {
         resume = JSON.parse(resumeContent); // Parse the string content
         console.log("Existing resume found and parsed");
       } catch (parseError) {
         console.error("Error parsing existing resume.json content:", parseError);
         throw new McpError(ErrorCode.InternalError, `Found resume.json, but failed to parse its content: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
       }
    }

    // Step 2: Analyze the current codebase
    console.log("Analyzing current project...");
    const analyzer = directory ? new CodebaseAnalyzer(directory) : codebaseAnalyzer;
    const codebaseAnalysis = await analyzer.analyze();

    // Step 3: Enhance the resume with the current project
    console.log("Enhancing resume with current project...");
    // NOTE: This part uses resumeEnhancer.enhanceWithCurrentProject and githubService.updateResume
    // which were NOT part of the provided implementation plan. Leaving as-is for now,
    // but they might need refactoring similar to enhanceResume if they don't exist or work as expected.
    const { updatedResume, changes, summary, userMessage, resumeLink } = await resumeEnhancer.enhanceWithCurrentProject(
      resume, // Pass the parsed/created resume object
      codebaseAnalysis,
      GITHUB_USERNAME || ''
    );

    // Step 4: Update the resume on GitHub
    console.log("Updating resume on GitHub...");
    // Assuming githubService.updateResume exists and works correctly.
    // If not, this needs changing based on available GitHubService methods.
    // const finalResume = await githubService.updateResume(updatedResume); // This method was mentioned as non-existent in the prompt.

    // TEMPORARY: Since updateResume doesn't exist, let's just log for now.
    console.warn("githubService.updateResume method not implemented/found. Skipping update step.");
    const finalResume = updatedResume; // Use updatedResume for return value

    return {
      message: "Resume enhanced with current project successfully (Update skipped)",
      changes: changes,
      summary,
      userMessage,
      resumeUrl: resumeLink || `https://registry.jsonresume.org/${GITHUB_USERNAME}`,
      projectName: codebaseAnalysis.repoName,
      warning: "?? Note: Automatic resume updates might have modified your resume in ways that don't match your preferences. You can revert to a previous version through your GitHub Gist revision history if needed. Update step was skipped."
    };
  } catch (error) {
    console.error("Error enhancing resume with project:", error);
     if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, `Error enhancing resume with project: ${error instanceof Error ? error.message : String(error)}`);
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Removed github_hello_tool as it wasn't in the list or plan
  if (request.params.name === "github_analyze_codebase") {
    console.log("Tool call: github_analyze_codebase", request.params.arguments);
    const input = request.params.arguments as { directory?: string };
    return await analyzeCodebase(input.directory);
  } else if (request.params.name === "github_check_resume") {
    console.log("Tool call: github_check_resume", request.params.arguments);
    return await checkResume();
  } else if (request.params.name === "github_enhance_resume_with_project") {
    console.log("Tool call: github_enhance_resume_with_project", request.params.arguments);
    const input = request.params.arguments as { directory?: string };
    return await enhanceResumeWithProject(input.directory);
  } else if (request.params.name === "enhance_resume") { // Updated tool name
    console.log("Tool call: enhance_resume", request.params.arguments);
    // Validate input using Zod or similar would be good practice here
    const input = request.params.arguments as { job_json_path: string };
    if (typeof input?.job_json_path !== 'string') {
       throw new McpError(ErrorCode.InvalidParams, `Missing or invalid 'job_json_path' argument.`);
    }
    return await enhanceResume(input.job_json_path); // Call the refactored function
  }

  console.error(`Unknown tool called: ${request.params.name}`);
  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
});

server.onerror = (error: any) => {
  // Log errors in a structured way if possible
  console.error("[MCP Server Error]", error);
};

process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down server...");
  await server.close();
  console.log("Server closed.");
  process.exit(0);
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("JsonResume MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
