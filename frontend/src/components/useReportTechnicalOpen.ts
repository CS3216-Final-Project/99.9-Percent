import { createContext, useContext } from "react";

export const ReportTechnicalOpen = createContext(false);
export const useReportTechnicalOpen = () => useContext(ReportTechnicalOpen);
