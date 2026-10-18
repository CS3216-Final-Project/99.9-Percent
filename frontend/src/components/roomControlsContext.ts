import { createContext, useContext } from "react";
export const Host = createContext<HTMLElement | null>(null);
export const Register = createContext<(element: HTMLDivElement | null) => void>(() => {});
export const useRoomControlsHost = () => useContext(Host);
