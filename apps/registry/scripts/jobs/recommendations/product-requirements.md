# JSON Resume Recommendation Engine

## Overview

The JSON Resume Recommendation Engine is a feature that analyzes a user's resume and current project to automatically enhance their resume with relevant skills, project details, and work experiences. This document outlines the requirements, architecture, and implementation details for this feature.

## Key Features

1. **Resume Analysis**: Analyzes existing JSON Resume content to understand the user's background
2. **Codebase Analysis**: Examines the user's current project to extract technologies, languages, and contributions
3. **Automatic Enhancement**:
   - Adds new skills based on technologies used in projects
   - Updates project details with current work
   - Makes recommendations for improving work experience descriptions
   - Validates against the JSON Resume schema to ensure compatibility
4. **User Experience**:
   - Provides a detailed summary of all changes made
   - Generates a direct link to view the updated resume
   - Includes warning about potential issues and how to revert changes
   - Maintains full resume.json output following JSON schema

## Architecture

The recommendation engine is built with the following components:

1. **Resume Enhancer**: Core class that orchestrates the enhancement process
2. **GitHub Service**: Handles resume retrieval and update through GitHub Gists
3. **Codebase Analyzer**: Extracts technologies, languages, and commit history from current project
4. **OpenAI Service**: Leverages AI to generate high-quality resume enhancements
5. **Schema Validation**: Ensures all modifications follow the JSON Resume schema

## Implementation Details

### ResumeEnhancer Class
- Extracts project information from codebase analysis
- Maps technologies to skill categories
- Processes changes through OpenAI
- Validates schema compliance
- Creates user-friendly output with detailed change information

### OpenAI Integration
- Generates new project data for the current codebase
- Identifies new skills from the codebase that aren't in the existing resume
- Strictly additive approach - never modifies or removes existing content
- Ensures professional tone and formatting in resume content
- Maintains consistency with existing resume by only adding complementary information

### Data Preservation Principles
- All existing resume data is preserved without modification
- New projects are only added if they don't already exist (checked by name)
- New skills are only added if they don't already exist in the resume
- Original formatting and structure of the resume is maintained
- Special properties (like _gistId) are preserved during enhancement

### Schema Validation
- Validates all modifications against JSON Resume schema
- Prevents invalid data structures or missing required fields
- Ensures backward compatibility with existing tools

### User Communication
- Provides markdown-formatted output with changes grouped by category
- Includes direct link to view updated resume
- Warns about potential issues and explains how to revert changes if needed

## Technical Requirements

1. TypeScript for type safety and improved development experience
2. GitHub API integration for resume storage and retrieval
3. OpenAI API for intelligent content generation
4. Schema validation to ensure compatibility
5. Error handling and logging for troubleshooting

## Implementation Notes

### OpenAIService Enhancements

The OpenAIService has been updated to use a more focused approach for resume enhancement:

1. **Targeted Prompt Design**:
   - Prompt now explicitly requests only a single new project and new skills
   - No mention of updating or modifying existing content
   - Clear instructions on what should and should not be generated

2. **Data Processing Changes**:
   - Added a dedicated `addProjectAndSkills` method that only adds new content
   - Pre-validation of existing projects to avoid duplicates
   - Strict filtering of skills to only add ones that don't already exist
   - Preserves special properties like `_gistId` during processing

3. **Response Structure**:
   - OpenAI now responds with specific `newProject` and `newSkills` properties
   - No full resume returned, only the specific additions
   - Includes a changes array describing what was added for user transparency

This approach ensures that resume enhancement is completely non-destructive and only adds relevant new information based on the user's current project.

## Future Enhancements

1. **Customization Options**: Allow users to control enhancement parameters
2. **Multi-project Analysis**: Analyze multiple projects for comprehensive skills extraction
3. **Historical Analysis**: Consider commit history and contribution patterns
4. **Industry-specific Recommendations**: Tailor enhancements based on industry norms
5. **Resume Optimization Scoring**: Provide metrics on resume completeness and quality
