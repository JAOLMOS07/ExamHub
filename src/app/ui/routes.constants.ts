export const PRINCIPAL = {
  NAME: "principal",
  HOME: "home",
  LOGIN: "login",
};
export const EXAM = {
  NAME: "exam",
};
export const MODULES = {
  HOME: {
    HOME: `/${PRINCIPAL.NAME}/${PRINCIPAL.HOME}`,
  },
  EXAM: {
    EXAM: `/${PRINCIPAL.NAME}/${EXAM.NAME}`,
  },
  LOGIN: {
    LOGIN: `/${PRINCIPAL.NAME}/${PRINCIPAL.LOGIN}`,
  },
};
