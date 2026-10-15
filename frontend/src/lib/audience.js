import { createContext, useContext } from "react";

// Для кого сайт сейчас: взрослые (adult) или дети и подростки (kid). Запоминается в браузере.
const KEY = "school-audience";
export const AudienceContext = createContext({ audience: "adult", setAudience: () => {} });
export const useAudience = () => useContext(AudienceContext);

export function loadAudience() {
  try { return localStorage.getItem(KEY) === "kid" ? "kid" : "adult"; } catch { return "adult"; }
}
export function saveAudience(a) {
  try { localStorage.setItem(KEY, a); } catch { /* не страшно */ }
}
export const forAudience = (course, audience) => !course.audience || course.audience.includes(audience);
