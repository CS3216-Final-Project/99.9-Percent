/** Anonymous, explicitly submitted player feedback; no save data is uploaded. */
export const FEEDBACK_MAX_LENGTH = 2000;

export interface FeedbackRequest {
  /** A stable random UUID for safe retries of the same submission. */
  id: string;
  message: string;
  mode: 'campaign' | 'classic';
}

export interface FeedbackResponse {
  id: string;
}
