import { OpenAIService } from '../src/openai.js';
import { ResumeEnhancer } from '../src/resume-enhancer.js';
import { Resume, JobDescription } from '../src/types.js';
import fs from 'fs/promises';

async function main() {
  try {
    // Load test data
    console.log('Loading test data...');
    const jobDescription = JSON.parse(
      await fs.readFile('tests/test-job.json', 'utf-8')
    ) as JobDescription;

    const sampleResume: Resume = {
      basics: {
        name: "John Doe",
        label: "Software Developer",
        email: "john@example.com",
        summary: "Full stack developer with experience in web technologies.",
        location: {
          city: "Sydney",
          countryCode: "AU",
          region: "NSW"
        }
      },
      skills: [
        {
          name: "JavaScript",
          level: "Advanced",
          keywords: ["ES6", "Node.js", "React"]
        },
        {
          name: "Python",
          level: "Intermediate",
          keywords: ["Django", "Flask"]
        }
      ],
      projects: [
        {
          name: "E-commerce Platform",
          description: "Built a scalable e-commerce platform using React and Node.js",
          highlights: [
            "Implemented responsive design",
            "Integrated payment processing"
          ],
          startDate: "2023-01",
          endDate: "2023-12"
        }
      ]
    };

    // Initialize services
    console.log('Initializing services...');
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    const openAIService = new OpenAIService(process.env.OPENAI_API_KEY);
    const resumeEnhancer = new ResumeEnhancer(openAIService);

    // Test job-based enhancement
    console.log('Testing job-based resume enhancement...');
    const result = await resumeEnhancer.enhanceForJob(sampleResume, jobDescription);

    // Log results
    console.log('\nEnhancement Results:');
    console.log('-------------------');
    console.log('Summary:', result.summary);
    console.log('\nSkills to Highlight:', result.skillsToHighlight);
    console.log('\nSuggested Projects:', result.suggestedProjects);
    if (result.updatedSummary) {
      console.log('\nUpdated Summary:', result.updatedSummary);
    }
    console.log('\nChanges:', result.changes.otherChanges);

    // Save enhanced resume
    console.log('\nSaving enhanced resume...');
    await fs.writeFile(
      'tests/enhanced-resume.json',
      JSON.stringify(result.updatedResume, null, 2)
    );
    console.log('Enhanced resume saved to tests/enhanced-resume.json');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
