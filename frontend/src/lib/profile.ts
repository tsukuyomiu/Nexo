import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(100, "Use até 100 caracteres."),
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail.")
    .email("Informe um email válido.")
    .max(255, "Use até 255 caracteres."),
  phone: z
    .string()
    .trim()
    .max(25, "Use até 25 caracteres.")
    .refine(
      (value) => !value || (/^[+\d\s().-]+$/.test(value) && value.replace(/\D/g, "").length >= 8),
      "Informe um telefone válido.",
    ),
  birthDate: z
    .string()
    .refine(
      (value) =>
        !value ||
        (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
          !Number.isNaN(Date.parse(value)) &&
          new Date(value).toISOString().slice(0, 10) === value &&
          value <= new Date().toISOString().slice(0, 10)),
      "Informe uma data de nascimento válida.",
    ),
  address: z.string().trim().max(200, "Use até 200 caracteres."),
});

export type Profile = z.infer<typeof profileSchema>;

export const emptyProfile: Profile = {
  name: "",
  email: "",
  phone: "",
  birthDate: "",
  address: "",
};

export function prepareProfile(input: Profile): Profile {
  return profileSchema.parse(input);
}

const PROFILE_STORAGE_PREFIX = "nexo:profile:";

export function saveLocalProfile(profile: Profile): void {
  if (typeof window === "undefined" || !profile.email) return;
  try {
    window.localStorage.setItem(
      PROFILE_STORAGE_PREFIX + profile.email.trim().toLowerCase(),
      JSON.stringify(profile),
    );
  } catch {
    // quota safe
  }
}

export function loadLocalProfile(email: string): Profile | null {
  if (typeof window === "undefined" || !email) return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_PREFIX + email.trim().toLowerCase());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const result = profileSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
