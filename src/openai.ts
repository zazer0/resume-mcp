import OpenAI from "openai";
import { Resume, JobDescription, Skill as ResumeSkill } from "./types.js";
import { CodebaseAnalysisResult } from "./codebase.js";
import {
  resumeUpdateSchema,
  jobResumeUpdateSchema,
  ResumeUpdate,
  JobResumeUpdate,
  JobBasedResumeUpdate,
  Skill
} from "./schemas.js";
import { z } from "zod";

export class OpenAIService {
  private client: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Adjusts a resume JSON object based on a job description JSON object.
   * Returns the modified resume as a JSON object.
   * Implements step 3 of the plan.
   */
  async adjustResumeForJob(resumeJson: object, jobDetails: object): Promise<object> {
    console.log("Preparing OpenAI call to adjust resume for job...");
    try {
      const resumeString = JSON.stringify(resumeJson, null, 2);
      const jobDetailsString = JSON.stringify(jobDetails, null, 2);

      const prompt = `Act as an expert career advisor and resume writer. Your task is to subtly adjust the provided JSON resume to better align with the requirements and keywords found in the provided job description JSON.

Review both the resume and the job description carefully. Identify skills, experiences, and qualifications in the resume that are most relevant to the job.

Modify the resume JSON object, focusing on:
1.  Subtly rephrasing parts of the summary, experience descriptions, or project highlights to use language closer to the job description, where appropriate.
2.  Ensuring the most relevant skills and experiences are prominent. Do NOT add skills or experiences the candidate doesn't possess.
3.  Maintaining the original structure and data types of the JSON resume.
4.  Making only necessary and subtle adjustments. Avoid drastic changes or fabrications.

Return ONLY the complete, modified JSON object for the resume. Do not include any introductory text, explanations, or markdown formatting. The output must be a single, valid JSON object representing the adjusted resume.

Job Description JSON:
\`\`\`json
${jobDetailsString}
\`\`\`

Current Resume JSON:
\`\`\`json
${resumeString}
\`\`\`

Modified Resume JSON (Return only this):`;

      console.log("Sending request to OpenAI API (using JSON mode)...");
      const startTime = Date.now(); // Start time before API call
      const response = await this.client.chat.completions.create({
        model: "gpt-4o", // Using a capable model, gpt-4-turbo is also a good option
        response_format: { type: "json_object" }, // Ensure JSON output
        messages: [
          {
            role: "system",
            content: "You are an expert career advisor specializing in tailoring JSON resumes to specific job descriptions. You output only valid JSON objects."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        // temperature: 0.5, // Adjust temperature for creativity vs consistency if needed
      });
      const endTime = Date.now(); // End time after API call
      console.log(`OpenAI API call duration: ${endTime - startTime}ms`); // Log duration

      const messageContent = response.choices[0]?.message?.content;

      if (!messageContent) {
        console.error("No content received from OpenAI API.");
        throw new Error("OpenAI API returned an empty response.");
      }

      console.log("Received response from OpenAI. Parsing JSON...");
      try {
        const adjustedResumeObject = JSON.parse(messageContent);
        console.log("Successfully parsed adjusted resume JSON.");
        // Basic validation: Check if it looks like a resume object (e.g., has a 'basics' property)
        if (typeof adjustedResumeObject !== 'object' || adjustedResumeObject === null || !adjustedResumeObject.hasOwnProperty('basics')) {
          console.warn("Parsed JSON doesn't look like a standard resume object.");
          // Depending on strictness, could throw an error here.
        }
        return adjustedResumeObject;
      } catch (parseError) {
        console.error("Failed to parse JSON response from OpenAI:", parseError);
        console.error("Raw OpenAI response content:", messageContent.substring(0, 500) + "..."); // Log snippet of raw response
        throw new Error(`Failed to parse the adjusted resume JSON received from OpenAI: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

    } catch (error) {
      console.error("Error during OpenAI resume adjustment:", error);
      // Re-throw the error to be handled by the caller (e.g., the MCP tool handler)
      throw error;
    }
  }


  /**
   * Generate resume updates based on a job description
   */
  async generateJobBasedEnhancement(
    resume: Resume,
    jobDescription: JobDescription
  ): Promise<JobResumeUpdate> {
    try {
      console.log("Preparing OpenAI API call for job-based resume enhancement...");

      const startTime = Date.now(); // Start time before API call
      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a professional resume writer that helps tailor resumes to specific job descriptions. Focus on:\n" +
              "1. Matching the resume's language and emphasis to the job requirements\n" +
              "2. Identifying which existing skills and projects best align with the role\n" +
              "3. Suggesting updates to make the resume more relevant\n" +
              "4. Maintaining professionalism and accuracy while highlighting relevant experience"
          },
          {
            role: "user",
            content: `Please analyze this job description and resume to suggest targeted improvements:

Job Description:
${JSON.stringify(jobDescription, null, 2)}

Current Resume:
${JSON.stringify(resume, null, 2)}`
          }
        ],
        functions: [
          {
            name: "enhance_resume_for_job",
            description: "Generate resume updates to better match a job description",
            parameters: {
              type: "object",
              properties: {
                updatedSummary: {
                  type: "string",
                  description: "Updated professional summary that aligns with the job requirements"
                },
                updatedSkills: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: {
                        type: "string",
                        description: "Skill name"
                      },
                      level: {
                        type: "string",
                        description: "Skill level"
                      },
                      keywords: {
                        type: "array",
                        items: { type: "string" },
                        description: "Related keywords"
                      }
                    }
                  },
                  description: "Updated skills section emphasizing relevant abilities"
                },
                skillsToHighlight: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of existing skills that are particularly relevant to this role"
                },
                suggestedProjects: {
                  type: "array",
                  items: { type: "string" },
                  description: "Names of existing projects that best demonstrate relevant experience"
                },
                changes: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of suggested changes and improvements"
                }
              },
              required: ["updatedSkills", "skillsToHighlight", "suggestedProjects", "changes"]
            }
          }
        ],
        function_call: { name: "enhance_resume_for_job" }
      });
      const endTime = Date.now(); // End time after API call
      console.log(`OpenAI API call duration: ${endTime - startTime}ms`); // Log duration

      const functionCall = response.choices[0]?.message?.function_call;
      if (!functionCall?.arguments) {
        throw new Error("No function call arguments received from OpenAI");
      }

      try {
        const result = JSON.parse(functionCall.arguments);
        const validated = jobResumeUpdateSchema.parse(result);
        console.log("Successfully validated job-based resume update schema");
        return validated;
      } catch (parseError) {
        console.error("Error parsing OpenAI response for job-based enhancement:", parseError);
        throw parseError;
      }
    } catch (error) {
      console.error("Error generating job-based resume enhancement:", error);
      throw error;
    }
  }

  async generateResumeEnhancement(
    codebaseAnalysis: CodebaseAnalysisResult
  ): Promise<ResumeUpdate> {
    try {
      console.log("Preparing OpenAI API call for resume enhancement...");

      // Call OpenAI API with function calling
      const startTime = Date.now(); // Start time before API call
      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a professional technical resume writer that creates high-quality JSON Resume compatible project entries and skills based on codebase analysis. Focus on capturing the essence and significance of the project, not just technical details.\n\n" +
              "Guidelines:\n" +
              "- Begin by clearly explaining what the project DOES and its PURPOSE - this is the most important part\n" +
              "- Focus on the problem it solves and value it provides to users or stakeholders\n" +
              "- Then mention key technical achievements and architectural decisions\n" +
              "- Create professional, substantive descriptions that highlight business value\n" +
              "- Avoid trivial details like file counts or minor technologies\n" +
              "- For dates, use YYYY-MM-DD format and ensure they are realistic (not in the future)\n" +
              "- For ongoing projects, omit the endDate field entirely\n" +
              "- Only include skills that are substantive and resume-worthy\n" +
              "- Group skills by category when possible\n" +
              "- Prioritize quality over quantity in skills and descriptions",
          },
          {
            role: "user",
            content: `Based on this codebase analysis, generate a single project entry and relevant skills for a resume that focuses first on WHAT the project does and WHY it matters, then how it was implemented:

${codebaseAnalysis.readmeContent ? `README.md Content:\n${codebaseAnalysis.readmeContent}\n\n` : ''}

Codebase Analysis:\n${JSON.stringify(codebaseAnalysis, null, 2)}`
          },
        ],
        functions: [
          {
            name: "create_resume_update",
            description: "Create a new project entry and skills based on codebase analysis",
            parameters: {
              type: "object",
              properties: {
                newProject: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "Professional project name"
                    },
                    startDate: {
                      type: "string",
                      description: "Project start date in YYYY-MM-DD or YYYY-MM format (must be a realistic date, not in the future)"
                    },
                    endDate: {
                      type: "string",
                      description: "Project end date in YYYY-MM-DD or YYYY-MM format. OMIT THIS FIELD ENTIRELY for ongoing projects - do not use 'Present' or future dates."
                    },
                    description: {
                      type: "string",
                      description: "Professional project description that STARTS by clearly explaining what the project does and why it matters. Begin with its purpose and function, then mention key technologies and implementation details. (60-100 words recommended)"
                    },
                    highlights: {
                      type: "array",
                      items: { type: "string" },
                      description: "Bullet points highlighting key achievements and technologies that demonstrate significant impact"
                    },
                    url: {
                      type: "string",
                      description: "Project URL"
                    },
                    roles: {
                      type: "array",
                      items: { type: "string" },
                      description: "Roles held during the project"
                    },
                    entity: {
                      type: "string",
                      description: "Organization name associated with the project"
                    },
                    type: {
                      type: "string",
                      description: "Type of project (application, library, etc.)"
                    }
                  },
                  required: ["name", "startDate", "description"]
                },
                newSkills: {
                  type: "array",
                  description: "Only include substantive, resume-worthy skills that demonstrate significant expertise",
                  items: {
                    type: "object",
                    properties: {
                      name: {
                        type: "string",
                        description: "Professional skill name"
                      },
                      level: {
                        type: "string",
                        description: "Skill proficiency level"
                      },
                      keywords: {
                        type: "array",
                        items: { type: "string" },
                        description: "Related keywords for this skill"
                      },
                      category: {
                        type: "string",
                        description: "Skill category for grouping (e.g., 'Programming Languages', 'Frameworks', 'Tools')"
                      }
                    },
                    required: ["name"]
                  }
                },
                changes: {
                  type: "array",
                  items: { type: "string" },
                  description: "Summary of changes made to the resume"
                }
              },
              required: ["newProject", "newSkills", "changes"]
            }
          }
        ],
        function_call: { name: "create_resume_update" }
      });
      const endTime = Date.now(); // End time after API call
      console.log(`OpenAI API call duration: ${endTime - startTime}ms`); // Log duration

      console.log("Received response from OpenAI API");

      const functionCall = response.choices[0]?.message?.function_call;
      if (!functionCall?.arguments) {
        console.error("Error: No function call arguments in OpenAI response");
        throw new Error("No function call arguments received from OpenAI");
      }

      // Parse and validate the response
      console.log("Parsing and validating OpenAI response...");
      try {
        const result = JSON.parse(functionCall.arguments);
        const validated = resumeUpdateSchema.parse(result);
        console.log("Successfully validated schema");
        return validated;
      } catch (parseError) {
        console.error("Error parsing OpenAI response:",
          parseError instanceof SyntaxError ? "JSON parse error" :
            parseError instanceof z.ZodError ? "Schema validation error" :
              "Unknown error"
        );
        console.error("Raw function call arguments:", functionCall.arguments.substring(0, 200) + "...");
        throw parseError;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Schema validation error:", error.errors);
      } else if (error instanceof SyntaxError) {
        console.error("JSON parsing error:", error.message);
      } else if (error instanceof Error) {
        console.error("OpenAI API error:", error.message);
        console.error("Error details:", error);
      } else {
        console.error("Unknown error:", error);
      }
      throw error;
    }
  }

  /**
   * Add only new project and skills to a resume without modifying any existing content
   */
  async enhanceResume(resume: Resume, update: ResumeUpdate | JobBasedResumeUpdate): Promise<Resume> {
    const result = JSON.parse(JSON.stringify(resume)) as Resume;

    // Store the _gistId separately so we can add it back later
    const gistId = (result as any)._gistId;

    // Add the new project if it exists and doesn't already exist in the resume
    if ('newProject' in update && update.newProject) {
      const existingProjects = new Set(
        (result.projects || [])
          .filter(project => project.name)
          .map(project => project.name!.toLowerCase())
      );

      if (update.newProject.name && !existingProjects.has(update.newProject.name.toLowerCase())) {
        result.projects = [...(result.projects || []), update.newProject];
      }
    }

    // Add new skills if they don't already exist
    const existingSkills = new Set(
      (result.skills || []).map((skill: string | ResumeSkill) => {
        if (typeof skill === 'string') {
          return skill.toLowerCase();
        }
        return skill.name?.toLowerCase() ?? '';
      })
    );

    const newSkills = update.newSkills.filter(skill =>
      skill.name && !existingSkills.has(skill.name.toLowerCase())
    );

    if (newSkills.length > 0) {
      result.skills = [...(result.skills || []), ...newSkills];
    }

    // Add back the _gistId if it existed
    if (gistId) {
      (result as any)._gistId = gistId;
    }

    return result;
  }

  /**
   * Generate a summary of updates made to the resume
   */
  async generateUpdateSummary(changes: string[]): Promise<string> {
    try {
      console.log("Generating update summary...");

      // Call OpenAI API to generate a summary
      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that creates concise summaries of resume updates."
          },
          {
            role: "user",
            content: `Create a brief, professional summary of these changes made to a resume:\n${changes.join('\n')}`
          }
        ],
        max_tokens: 150
      });

      const summary = response.choices[0]?.message?.content || "Resume updated with new project details and skills.";
      return summary;
    } catch (error) {
      console.error("Error generating update summary:", error);
      return "Resume updated with new project details and skills.";
    }
  }
}
