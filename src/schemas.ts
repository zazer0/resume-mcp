import { z } from 'zod';

// ISO date format validation (YYYY-MM-DD)
const isoDateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  "Date must be in YYYY-MM-DD format"
);

// Skill schema with categorization support
export const skillSchema = z.object({
  name: z.string().min(1, "Skill name is required"),
  level: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

// Project schema aligned with JSON Resume standard
export const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  startDate: isoDateSchema,
  endDate: isoDateSchema.optional(), // Optional for ongoing projects
  description: z.string().min(10, "Description should be meaningful and professional"),
  highlights: z.array(z.string()).optional(),
  url: z.string().url("URL must be valid").optional(),
});

// Job skill schema
export const jobSkillSchema = z.object({
  name: z.string().min(1, "Skill name is required"),
  level: z.string(),
  keywords: z.array(z.string()),
});

// Location schema
export const locationSchema = z.object({
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  countryCode: z.string().optional(),
  region: z.string().optional(),
});

// Job description schema
export const jobDescriptionSchema = z.object({
  title: z.string().min(1, "Job title is required"),
  company: z.string().min(1, "Company name is required"),
  type: z.string(),
  date: z.string(),
  description: z.string().min(10, "Description should be meaningful"),
  location: locationSchema,
  remote: z.string().optional(),
  salary: z.string().optional(),
  experience: z.string().optional(),
  responsibilities: z.array(z.string()),
  qualifications: z.array(z.string()),
  skills: z.array(jobSkillSchema),
});

// Resume update schema for OpenAI function calls
export const resumeUpdateSchema = z.object({
  newProject: projectSchema,
  newSkills: z.array(skillSchema),
  changes: z.array(z.string()),
});

// Job-based resume update schema
export const jobResumeUpdateSchema = z.object({
  updatedSummary: z.string().optional(),
  updatedSkills: z.array(skillSchema),
  skillsToHighlight: z.array(z.string()),
  suggestedProjects: z.array(z.string()),
  changes: z.array(z.string()),
});

// Resume update schema for job-based updates (without project requirement)
export const jobBasedResumeUpdateSchema = z.object({
  newSkills: z.array(skillSchema),
  changes: z.array(z.string()),
});

// Type definitions for the schemas
export type Skill = z.infer<typeof skillSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ResumeUpdate = z.infer<typeof resumeUpdateSchema>;
export type JobResumeUpdate = z.infer<typeof jobResumeUpdateSchema>;
export type JobBasedResumeUpdate = z.infer<typeof jobBasedResumeUpdateSchema>;
