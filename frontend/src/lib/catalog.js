import { createContext, useContext } from "react";

export const CatalogContext = createContext(null);
export const useCatalog = () => useContext(CatalogContext);

export const courseById = (c, id) => c.courses.find((x) => x.id === id);
export const categoryById = (c, id) => c.categories.find((x) => x.id === id);
export const botUrl = (c) => (c?.bot_username ? `https://t.me/${c.bot_username}` : null);
export const categoryHref = (id) => (id === "chinese" ? "#/chinese" : id === "exams" ? "#/exams" : `#/courses?cat=${id}`);
