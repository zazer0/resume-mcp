import { z } from 'zod';

// ISO date format validation (YYYY-MM-DD)
const isoDateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  "Date must be in YYYY-MM-DD format"
);

// Project schema aligned with JSON Resume standard
export const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  startDate: isoDateSchema,
  endDate: isoDateSchema.optional(), // Optional for ongoing projects
  description: z.string().min(10, "Description should be meaningful and professional"),
  highlights: z.array(z.string()).optional(),
  url: z.string().url("URL must be valid").optional(),
});

// Skill schema with categorization support
export const skillSchema = z.object({
  name: z.string().min(1, "Skill name is required"),
  level: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

// Resume update schema for OpenAI function calls
export const resumeUpdateSchema = z.object({
  newProject: projectSchema,
  newSkills: z.array(skillSchema),
  changes: z.array(z.string()),
});

// Type definitions for the schemas
export type Skill = z.infer<typeof skillSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ResumeUpdate = z.infer<typeof resumeUpdateSchema>;
