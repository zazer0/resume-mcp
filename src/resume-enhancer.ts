import { Resume, JobDescription } from './types.js';
import { OpenAIService } from './openai.js';
import { CodebaseAnalysisResult } from './codebase.js';
import { JobBasedResumeUpdate } from './schemas.js';

export interface EnhancementResult {
  updatedResume: Resume;
  changes: {
    addedSkills: string[];
    updatedProjects: string[];
    updatedWork: string[];
    otherChanges: string[];
  };
  summary: string;
  userMessage?: string;
  resumeLink?: string;
}

export interface JobEnhancementResult extends EnhancementResult {
  skillsToHighlight: string[];
  suggestedProjects: string[];
  updatedSummary?: string;
}

export class ResumeEnhancer {
  private openAIService: OpenAIService;

  constructor(openAIService: OpenAIService) {
    this.openAIService = openAIService;
  }

  /**
   * Orchestrates the resume enhancement process based on job details.
   * Parses resume content, calls OpenAI for adjustment, and returns the stringified result.
   * Implements step 4 of the plan.
   * @param resumeContent The current resume content as a JSON string.
   * @param jobDetails The job details as a parsed JSON object.
   * @returns The enhanced resume content as a formatted JSON string.
   */
  async enhance(resumeContent: string, jobDetails: object): Promise<string> {
    console.log("Starting enhancement orchestration...");
    let resumeJson: object;

    // 1. Parse the input resumeContent string
    try {
      resumeJson = JSON.parse(resumeContent);
      console.log("Successfully parsed current resume content.");
    } catch (parseError) {
      console.error("Error parsing current resume content:", parseError);
      throw new Error(`Failed to parse the provided resume content: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    // 2. Call OpenAI service to get the adjusted resume object
    let adjustedResumeObject: object;
    try {
      console.log("Calling OpenAI service to adjust resume...");
      adjustedResumeObject = await this.openAIService.adjustResumeForJob(resumeJson, jobDetails);
      console.log("Successfully received adjusted resume object from OpenAI.");
    } catch (openaiError) {
      console.error("Error calling OpenAI service for resume adjustment:", openaiError);
      throw openaiError; // Re-throw the error from the OpenAI service
    }

    // 3. Convert the adjusted object back to a formatted JSON string
    try {
      const enhancedResumeString = JSON.stringify(adjustedResumeObject, null, 2);
      console.log("Successfully stringified the adjusted resume object.");
      return enhancedResumeString;
    } catch (stringifyError) {
       console.error("Error stringifying the adjusted resume object:", stringifyError);
       throw new Error(`Failed to format the adjusted resume into JSON string: ${stringifyError instanceof Error ? stringifyError.message : String(stringifyError)}`);
    }
  }

  /**
   * Enhance a resume to better match a job description (Older implementation, might be deprecated by `enhance`)
   */
  async enhanceForJob(
    resume: Resume,
    jobDescription: JobDescription
  ): Promise<JobEnhancementResult> {
    try {
      console.log('Starting resume enhancement for job match...');

      // Get resume updates from OpenAI
      console.log('Calling OpenAI to generate job-based resume enhancement...');
      const update = await this.openAIService.generateJobBasedEnhancement(resume, jobDescription);
      console.log('Received resume updates from OpenAI');

      // Apply the updates to the resume
      console.log('Enhancing resume with job-specific updates...');
      const updatedResume = await this.openAIService.enhanceResume(resume, {
        newSkills: update.updatedSkills,
        changes: update.changes
      } as JobBasedResumeUpdate);
      console.log('Resume enhanced successfully');

      // Generate a summary of the changes
      console.log('Generating update summary...');
      const summary = await this.openAIService.generateUpdateSummary(update.changes);
      console.log('Summary generated');

      return {
        updatedResume,
        changes: {
          addedSkills: update.updatedSkills.map(s => s.name),
          updatedProjects: [],
          updatedWork: [],
          otherChanges: update.changes
        },
        summary,
        skillsToHighlight: update.skillsToHighlight,
        suggestedProjects: update.suggestedProjects,
        updatedSummary: update.updatedSummary
      };
    } catch (error) {
      console.error('Error enhancing resume for job:', error);
      throw error;
    }
  }

  async enhanceWithCurrentProject(
    resume: Resume,
    codebaseAnalysis: CodebaseAnalysisResult,
    githubUsername: string
  ): Promise<EnhancementResult> {
    try {
      console.log('Starting resume enhancement with codebase details:', JSON.stringify({
        repoName: codebaseAnalysis.repoName,
        languages: Object.keys(codebaseAnalysis.languages),
        technologies: codebaseAnalysis.technologies
      }));

      // Get resume updates from OpenAI
      console.log('Calling OpenAI to generate resume enhancement...');
      const update = await this.openAIService.generateResumeEnhancement(codebaseAnalysis);
      console.log('Received resume updates from OpenAI');

      // Apply the updates to the resume
      console.log('Enhancing resume with new data...');
      const updatedResume = await this.openAIService.enhanceResume(resume, update);
      console.log('Resume enhanced successfully');

      // Generate a summary of the changes
      console.log('Generating update summary...');
      const summary = await this.openAIService.generateUpdateSummary(update.changes);
      console.log('Summary generated');

      // Create user message
      const userMessage = this.createUserMessage(githubUsername, update.changes);

      return {
        updatedResume,
        changes: {
          addedSkills: update.newSkills.map(s => s.name),
          updatedProjects: [update.newProject.name],
          updatedWork: [],
          otherChanges: update.changes
        },
        summary,
        userMessage,
        resumeLink: `https://registry.jsonresume.org/${githubUsername}`
      };
    } catch (error) {
      console.error('Error enhancing resume with current project:', error);
      throw error;
    }
  }

  /**
   * Create a user-friendly message with details about the updates and a link to the resume
   */
  private createUserMessage(username: string, changes: string[]): string {
    return `Your resume has been updated with your latest project contributions! View it at https://registry.jsonresume.org/${username}\n\nChanges made:\n${changes.map(c => `- ${c}`).join('\n')}\n\n?? Note: Please review the changes to ensure they match your preferences. You can revert to a previous version through your GitHub Gist revision history if needed.`;
  }
}
