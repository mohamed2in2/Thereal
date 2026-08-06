export type JobType =
  | "ExamGeneration"
  | "PDFProcessing"
  | "OCR"
  | "Analytics"
  | "BulkRecommendations"
  | "TeacherReport";

export type JobStatus = "Pending" | "Processing" | "Completed" | "Failed";

export interface AIJob {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
  progressPercentage: number;
  error?: string;
  createdAt: Date;
}

export class JobQueue {
  private static instance: JobQueue;
  private jobs: Map<string, AIJob> = new Map();

  public static getInstance(): JobQueue {
    if (!JobQueue.instance) {
      JobQueue.instance = new JobQueue();
    }
    return JobQueue.instance;
  }

  public enqueueJob(type: JobType, payload: Record<string, unknown>): AIJob {
    const job: AIJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      payload,
      status: "Pending",
      progressPercentage: 0,
      createdAt: new Date(),
    };

    this.jobs.set(job.id, job);
    this.processJobAsync(job.id);
    return job;
  }

  private async processJobAsync(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = "Processing";
    job.progressPercentage = 50;

    setTimeout(() => {
      job.status = "Completed";
      job.progressPercentage = 100;
    }, 10);
  }

  public getJob(jobId: string): AIJob | undefined {
    return this.jobs.get(jobId);
  }
}
