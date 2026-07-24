import type { Language } from "./strings";

// Home / navigation / task copy for the chat-first surfaces, kept in a separate
// table from strings.ts so the food-lens and safety strings can evolve
// independently. English values are the literal strings the components and
// buildTodayTasks used before localization, so the English render is unchanged.
export type HomeStringKey =
  | "greetingMorning"
  | "greetingAfternoon"
  | "greetingEvening"
  | "statusNeedsAttentionOne"
  | "statusNeedsAttentionMany"
  | "statusToDoOne"
  | "statusToDoMany"
  | "statusClear"
  | "assistantBubble"
  | "toneUrgent"
  | "toneActive"
  | "toneSuggested"
  | "composerPlaceholder"
  | "composerLabel"
  | "composerSpeak"
  | "composerStop"
  | "composerSend"
  | "navHome"
  | "navMenu"
  | "greetingHello"
  | "chipUrgentBadge"
  | "taskBpClinicalUrgentTitle"
  | "taskBpClinicalBlockedTitle"
  | "taskBpClinicalShareTitle"
  | "taskBpClinicalBlockedBody"
  | "taskBpClinicalClinicianBody"
  | "taskBpClinicalStandardBody"
  | "taskBpClinicalSameDayBody"
  | "taskBpFirstTitle"
  | "taskBpFirstBody"
  | "taskMedBarrierTitle"
  | "taskMedBarrierBody"
  | "taskMedPurposeTitle"
  | "taskMedPurposeBody"
  | "taskCheckinTitle"
  | "taskCheckinBody"
  | "taskVisitTitle"
  | "taskSafeStateTitle"
  | "taskSafeStateBody"
  | "menuGroupTrack"
  | "menuGroupUnderstand"
  | "menuGroupSupport"
  | "menuGroupManage"
  | "menuNumbersLabel"
  | "menuNumbersDesc"
  | "menuGlucoseLabel"
  | "menuGlucoseDesc"
  | "menuMedicinesLabel"
  | "menuMedicinesDesc"
  | "menuFoodLabel"
  | "menuFoodDesc"
  | "menuRetinopathyLearnLabel"
  | "menuRetinopathyLearnDesc"
  | "menuPlanLabel"
  | "menuPlanDesc"
  | "menuVisitsLabel"
  | "menuVisitsDesc"
  | "menuCoachLabel"
  | "menuCoachDesc"
  | "menuCheckinLabel"
  | "menuCheckinDesc"
  | "menuMoodLabel"
  | "menuMoodDesc"
  | "menuSupportLabel"
  | "menuSupportDesc"
  | "menuFamilyLabel"
  | "menuFamilyDesc"
  | "menuIntakeLabel"
  | "menuIntakeDesc"
  | "menuPrivacyLabel"
  | "menuPrivacyDesc"
  | "menuScreeningLabel"
  | "menuScreeningDesc"
  | "menuDemoResetTitle"
  | "menuDemoResetBody"
  | "menuDemoResetButton"
  | "taskScreeningBookedTitle"
  | "taskScreeningBookedBody"
  | "taskRecallTitle"
  | "taskRecallBody";

export const homeStrings: Record<Language, Record<HomeStringKey, string>> = {
  en: {
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    statusNeedsAttentionOne: "1 thing needs your attention",
    statusNeedsAttentionMany: "{count} things need your attention",
    statusToDoOne: "1 thing to do today",
    statusToDoMany: "{count} things to do today",
    statusClear: "Nothing urgent right now",
    assistantBubble: "Here is what matters at home today. Tap one to get started.",
    toneUrgent: "Reach your care team today",
    toneActive: "Ready when you are",
    toneSuggested: "Suggested for you",
    composerPlaceholder: "Tell me what you need…",
    composerLabel: "Tell me what you need",
    composerSpeak: "Speak to the assistant",
    composerStop: "Stop listening",
    composerSend: "Send",
    navHome: "Home",
    navMenu: "All my health",
    greetingHello: "Hello",
    chipUrgentBadge: "urgent",
    taskBpClinicalUrgentTitle: "Seek urgent help now",
    taskBpClinicalBlockedTitle: "Review this note with your care team",
    taskBpClinicalShareTitle: "Share this reading with your care team",
    taskBpClinicalBlockedBody:
      "You mentioned a medication change in this reading. Message your care team before making any medication adjustments.",
    taskBpClinicalClinicianBody: "This met a threshold in your clinician-authored care plan. Share this reading today.",
    taskBpClinicalStandardBody: "This met a standard-home blood pressure threshold. Share this reading and check with your care team.",
    taskBpClinicalSameDayBody: "This reading suggests a same-day review with your care team.",
    taskBpFirstTitle: "Check blood pressure",
    taskBpFirstBody: "Log your first home reading so your plan can start building a pattern.",
    taskMedBarrierTitle: "Share what got in the way",
    taskMedBarrierBody: "Your medicine list has a barrier marked. Turn it into a clear question for your care team.",
    taskMedPurposeTitle: "Review why your medicine matters",
    taskMedPurposeBody: "A quick explanation can make daily medicine feel less random.",
    taskCheckinTitle: "A quick health check is ready",
    taskCheckinBody: "A short, private check-in is ready when you are. It is optional.",
    taskVisitTitle: "Prepare for your next visit",
    taskSafeStateTitle: "No urgent items to review today",
    taskSafeStateBody: "You have no urgent home signals right now. Keep logging your blood pressure on your normal schedule.",
    menuGroupTrack: "Track your health",
    menuGroupUnderstand: "Understand your care",
    menuGroupSupport: "Check in and get support",
    menuGroupManage: "Manage",
    menuNumbersLabel: "My Numbers",
    menuNumbersDesc: "Log blood pressure and see your trend",
    menuGlucoseLabel: "My Blood Sugar",
    menuGlucoseDesc: "Log blood sugar and see your trend",
    menuMedicinesLabel: "My Medicines",
    menuMedicinesDesc: "Understand your medicines and adherence",
    menuFoodLabel: "Food",
    menuFoodDesc: "Ask about a food with the camera",
    menuRetinopathyLearnLabel: "Diabetic Eye Disease",
    menuRetinopathyLearnDesc: "Learn what it is and why screening matters",
    menuPlanLabel: "My Plan",
    menuPlanDesc: "Your care plan and instructions",
    menuVisitsLabel: "My Visits",
    menuVisitsDesc: "Get ready for your next visit",
    menuCoachLabel: "Coach",
    menuCoachDesc: "Ask a question about your care",
    menuCheckinLabel: "Check-ins & screenings",
    menuCheckinDesc: "Check what is due and review your history",
    menuMoodLabel: "Mood Check-in",
    menuMoodDesc: "A short, private PHQ-9 mood check-in",
    menuSupportLabel: "Support",
    menuSupportDesc: "Find local food, housing, and utility help",
    menuFamilyLabel: "Ladder — your child's development",
    menuFamilyDesc: "Find developmental resources for your child",
    menuIntakeLabel: "Add Instructions",
    menuIntakeDesc: "Paste care instructions to review",
    menuPrivacyLabel: "Privacy",
    menuPrivacyDesc: "Export or delete your data",
    menuScreeningLabel: "Eye Check",
    menuScreeningDesc: "Find and book your diabetes eye screening",
    menuDemoResetTitle: "Demo reset",
    menuDemoResetBody: "Start over as Brent, due for an eye screening.",
    menuDemoResetButton: "Reset demo",
    taskScreeningBookedTitle: "Eye screening — {site}, {when}",
    taskScreeningBookedBody: "About 10 minutes. Usually no dilation. Bring the printed report back to the app afterward.",
    taskRecallTitle: "Eye check coming up",
    taskRecallBody: "Your yearly diabetes eye photo is due around {monthYear}. Booking early keeps it easy."
  },
  es: {
    greetingMorning: "Buenos días",
    greetingAfternoon: "Buenas tardes",
    greetingEvening: "Buenas noches",
    statusNeedsAttentionOne: "1 cosa necesita tu atención",
    statusNeedsAttentionMany: "{count} cosas necesitan tu atención",
    statusToDoOne: "1 cosa para hacer hoy",
    statusToDoMany: "{count} cosas para hacer hoy",
    statusClear: "Nada urgente por ahora",
    assistantBubble: "Esto es lo que importa en casa hoy. Toca una para empezar.",
    toneUrgent: "Comunícate con tu equipo de salud hoy",
    toneActive: "Listo cuando quieras",
    toneSuggested: "Sugerido para ti",
    composerPlaceholder: "Dime qué necesitas…",
    composerLabel: "Dime qué necesitas",
    composerSpeak: "Habla con el asistente",
    composerStop: "Dejar de escuchar",
    composerSend: "Enviar",
    navHome: "Inicio",
    navMenu: "Toda mi salud",
    greetingHello: "Hola",
    chipUrgentBadge: "urgente",
    taskBpClinicalUrgentTitle: "Busca ayuda urgente ahora",
    taskBpClinicalBlockedTitle: "Revisa esta nota con tu equipo de salud",
    taskBpClinicalShareTitle: "Comparte esta lectura con tu equipo de salud",
    taskBpClinicalBlockedBody:
      "Mencionaste un cambio de medicamento en esta lectura. Escríbele a tu equipo de salud antes de hacer cualquier ajuste de medicamento.",
    taskBpClinicalClinicianBody: "Esto alcanzó un umbral en tu plan de cuidado autorizado por tu clínico. Comparte esta lectura hoy.",
    taskBpClinicalStandardBody:
      "Esto alcanzó un umbral estándar de presión arterial en casa. Comparte esta lectura y consulta con tu equipo de salud.",
    taskBpClinicalSameDayBody: "Esta lectura sugiere una revisión el mismo día con tu equipo de salud.",
    taskBpFirstTitle: "Toma tu presión arterial",
    taskBpFirstBody: "Registra tu primera lectura en casa para que tu plan empiece a formar un patrón.",
    taskMedBarrierTitle: "Comparte qué te lo impidió",
    taskMedBarrierBody: "Tu lista de medicinas tiene una barrera marcada. Conviértela en una pregunta clara para tu equipo de salud.",
    taskMedPurposeTitle: "Repasa por qué importa tu medicina",
    taskMedPurposeBody: "Una explicación rápida puede hacer que la medicina diaria se sienta menos al azar.",
    taskCheckinTitle: "Hay un chequeo rápido de salud listo",
    taskCheckinBody: "Hay un chequeo breve y privado listo cuando quieras. Es opcional.",
    taskVisitTitle: "Prepárate para tu próxima visita",
    taskSafeStateTitle: "No hay temas urgentes que revisar hoy",
    taskSafeStateBody: "No tienes señales urgentes en casa ahora mismo. Sigue registrando tu presión arterial en tu horario normal.",
    menuGroupTrack: "Sigue tu salud",
    menuGroupUnderstand: "Entiende tu cuidado",
    menuGroupSupport: "Chequea y busca apoyo",
    menuGroupManage: "Administra",
    menuNumbersLabel: "Mis Números",
    menuNumbersDesc: "Registra tu presión arterial y ve tu tendencia",
    menuGlucoseLabel: "Mi Azúcar en Sangre",
    menuGlucoseDesc: "Registra tu azúcar en sangre y ve tu tendencia",
    menuMedicinesLabel: "Mis Medicinas",
    menuMedicinesDesc: "Entiende tus medicinas y tu constancia",
    menuFoodLabel: "Comida",
    menuFoodDesc: "Pregunta sobre una comida con la cámara",
    menuRetinopathyLearnLabel: "Enfermedad Diabética del Ojo",
    menuRetinopathyLearnDesc: "Aprende qué es y por qué importa el examen",
    menuPlanLabel: "Mi Plan",
    menuPlanDesc: "Tu plan de cuidado e instrucciones",
    menuVisitsLabel: "Mis Visitas",
    menuVisitsDesc: "Prepárate para tu próxima visita",
    menuCoachLabel: "Asesor",
    menuCoachDesc: "Haz una pregunta sobre tu cuidado",
    menuCheckinLabel: "Chequeos y evaluaciones",
    menuCheckinDesc: "Revisa lo pendiente y tu historial",
    menuMoodLabel: "Chequeo de Ánimo",
    menuMoodDesc: "Un chequeo de ánimo PHQ-9 breve y privado",
    menuSupportLabel: "Apoyo",
    menuSupportDesc: "Encuentra ayuda local de comida, vivienda y servicios",
    menuFamilyLabel: "Ladder — el desarrollo de tu hijo o hija",
    menuFamilyDesc: "Encuentra recursos de desarrollo para tu hijo o hija",
    menuIntakeLabel: "Agregar Instrucciones",
    menuIntakeDesc: "Pega instrucciones de cuidado para revisar",
    menuPrivacyLabel: "Privacidad",
    menuPrivacyDesc: "Exporta o borra tus datos",
    menuScreeningLabel: "Chequeo de Ojos",
    menuScreeningDesc: "Encuentra y reserva tu examen de ojos por la diabetes",
    menuDemoResetTitle: "Reiniciar demo",
    menuDemoResetBody: "Vuelve a empezar como Brent, pendiente de un examen de ojos.",
    menuDemoResetButton: "Reiniciar demo",
    taskScreeningBookedTitle: "Examen de ojos — {site}, {when}",
    taskScreeningBookedBody: "Unos 10 minutos. Normalmente sin dilatación. Después, trae el reporte impreso a la app.",
    taskRecallTitle: "Se acerca tu chequeo de ojos",
    taskRecallBody: "Tu foto anual de ojos por la diabetes toca alrededor de {monthYear}. Reservar temprano lo hace fácil."
  }
};

export function tHome(language: Language, key: HomeStringKey, vars?: Record<string, string | number>): string {
  const template = homeStrings[language]?.[key] ?? homeStrings.en[key];
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}
