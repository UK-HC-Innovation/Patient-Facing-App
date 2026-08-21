export type Language = "en" | "es";

export type FoodLensStringKey =
  | "pageTitle"
  | "navLabel"
  | "viewfinderHint"
  | "scanHint"
  | "statusConnecting"
  | "statusListening"
  | "statusThinking"
  | "statusSpeaking"
  | "statusIdle"
  | "statusIdleNoFood"
  | "statusError"
  | "tapToStart"
  | "endSession"
  | "resume"
  | "retry"
  | "cameraRetry"
  | "scanAgain"
  | "switchToTyped"
  | "cameraDenied"
  | "micDenied"
  | "cameraUnavailable"
  | "fallbackNotice"
  | "askPlaceholder"
  | "askButton"
  | "holdToTalkHint"
  | "liveTypedHint"
  | "visionEstimateBadge"
  | "unknownFood"
  | "portionAssuming"
  | "portionSizeAssumption"
  | "sizePersonal"
  | "sizeSmall"
  | "sizeMedium"
  | "sizeRegular"
  | "sizeLarge"
  | "sizeExtraLarge"
  | "sizeFamily"
  | "portionLabel"
  | "portionDecrease"
  | "portionIncrease"
  | "nutritionCalories"
  | "nutritionSodium"
  | "nutritionCarbs"
  | "nutritionAddedSugars"
  | "logThis"
  | "loggedConfirmation"
  | "recentMealsTitle"
  | "noMealsYet"
  | "foodNotThis"
  | "weekInFoodTitle"
  | "weekMealsLogged"
  | "weekAverageItemScore"
  | "weekBandMix"
  | "weekBest"
  | "weekRoom"
  | "weekOpenFood"
  | "postMealNudgeTitle"
  | "postMealNudgeBody"
  | "postMealNudgeCta"
  | "postMealNudgeDismiss"
  | "mealAteEarlier"
  | "mealTimeReason"
  | "mealThirtyMinutesAgo"
  | "mealOneHourAgo"
  | "mealTwoHoursAgo"
  | "mealCustomTime"
  | "mealSaveTime"
  | "mealTimePastError"
  | "mealDelete"
  | "mealConfirmDelete"
  | "mealCancel"
  | "betterOptionHint"
  | "flagSodium"
  | "flagSaturatedFat"
  | "flagAddedSugars"
  | "flagCarbs"
  | "flagPotassiumGood"
  | "flagFiberGood"
  | "flagPotassiumMed"
  | "flagSaltSubstituteMed"
  | "flagMetforminAlcohol"
  | "flagBpTrend"
  | "pantryButton"
  | "pantryScanning"
  | "pantryDetectedTitle"
  | "pantryRecipesTitle"
  | "pantryToBuyLabel"
  | "pantryShoppingTitle"
  | "pantryWatchLabel"
  | "pantryUnavailable"
  | "pantryNoFood"
  | "pantryLocked"
  | "compassScoreLabel"
  | "compassBandEncourage"
  | "compassBandModerate"
  | "compassBandMinimize"
  | "compassEstimateBadge"
  | "compassEstimateNote"
  | "compassCalorieDensity"
  | "compassDensityVeryLow"
  | "compassDensityLow"
  | "compassDensityMedium"
  | "compassDensityHigh"
  | "compassDensityUnknown"
  | "compassBetterOptions"
  | "compassAlreadyBest"
  | "compassNoCloseMatch"
  | "compassRecipeLink"
  | "compassCarveOutZeroCalorie"
  | "compassCarveOutBelow5"
  | "compassCarveOutAlcohol"
  | "compassCarveOutInfant"
  | "compassCarveOutSpecialized"
  | "compassAmbiguous"
  | "compassPointAtFood"
  | "compassScoring"
  | "compassMissingDomains"
  | "compassOutOf100";

export const foodLensStrings: Record<Language, Record<FoodLensStringKey, string>> = {
  en: {
    pageTitle: "Food Lens",
    navLabel: "Food",
    viewfinderHint: "Point at a food and just ask.",
    scanHint: "Point at any food and ask about it.",
    statusConnecting: "Connecting…",
    statusListening: "Listening — just talk.",
    statusThinking: "Thinking…",
    statusSpeaking: "Speaking…",
    statusIdle: "Tap start to talk about this food.",
    statusIdleNoFood: "Tap start and describe your food.",
    statusError: "Something went wrong.",
    tapToStart: "Start",
    endSession: "End",
    resume: "Resume",
    retry: "Try again",
    cameraRetry: "Retry camera",
    scanAgain: "Scan again",
    switchToTyped: "Switch to typed mode",
    cameraDenied: "Camera unavailable in this preview. You can still use the typed controls below.",
    micDenied: "Microphone access is off. You can still type your question below.",
    cameraUnavailable: "Camera unavailable in this preview. You can still use the typed controls below.",
    fallbackNotice: "Type your question about what's in the camera and I'll answer.",
    askPlaceholder: "Ask about this food…",
    askButton: "Ask",
    holdToTalkHint: "Speak your question out loud.",
    liveTypedHint: "You can also type while the voice conversation is live.",
    visionEstimateBadge: "Estimate from photo",
    unknownFood: "This food",
    portionAssuming: "Assuming {servings} serving(s) - tap to change.",
    portionSizeAssumption: "{size} ≈ {servings} servings — adjust?",
    sizePersonal: "personal",
    sizeSmall: "small",
    sizeMedium: "medium",
    sizeRegular: "regular",
    sizeLarge: "large",
    sizeExtraLarge: "extra-large",
    sizeFamily: "family",
    portionLabel: "Servings",
    portionDecrease: "Decrease servings",
    portionIncrease: "Increase servings",
    nutritionCalories: "Calories",
    nutritionSodium: "Sodium",
    nutritionCarbs: "Carbs",
    nutritionAddedSugars: "Added sugars",
    logThis: "Log this",
    loggedConfirmation: "Added to your meals",
    recentMealsTitle: "Recent meals",
    noMealsYet: "No meals logged yet.",
    foodNotThis: "Not this?",
    weekInFoodTitle: "Week in Food",
    weekMealsLogged: "{count} meals logged in the last 7 days",
    weekAverageItemScore: "average item score",
    weekBandMix: "Band mix",
    weekBest: "Best: {food} ({score})",
    weekRoom: "Room to improve: {food} ({score})",
    weekOpenFood: "Open Food Lens",
    postMealNudgeTitle: "Check your blood sugar",
    postMealNudgeBody: "About {hours} hours since your {food} — a good time to check your blood sugar.",
    postMealNudgeCta: "Log a reading",
    postMealNudgeDismiss: "Dismiss",
    mealAteEarlier: "I ate this earlier",
    mealTimeReason: "Post-meal pairing uses the time you ate.",
    mealThirtyMinutesAgo: "30 min ago",
    mealOneHourAgo: "1 h ago",
    mealTwoHoursAgo: "2 h ago",
    mealCustomTime: "Custom meal time",
    mealSaveTime: "Save time",
    mealTimePastError: "Choose a valid time that is not in the future.",
    mealDelete: "Delete",
    mealConfirmDelete: "Yes, delete",
    mealCancel: "Cancel",
    betterOptionHint: "Ask for a better option.",
    flagSodium: "{amount} mg sodium — {percent}% of your {limit} mg daily limit",
    flagSaturatedFat: "{amount} g saturated fat — {percent}% of your {limit} g daily limit",
    flagAddedSugars: "{amount} g added sugars — {percent}% of your {limit} g daily limit",
    flagCarbs: "{amount} g carbs — {percent}% of your {limit} g daily reference",
    flagPotassiumGood: "{amount} mg potassium — good for blood pressure",
    flagFiberGood: "{amount} g fiber — good for your heart",
    flagPotassiumMed: "High in potassium — check with your care team first because you take {med}",
    flagSaltSubstituteMed: "This is a salt substitute — check with your care team first because you take {med}",
    flagMetforminAlcohol: "Alcohol with {med} can upset your stomach and affect your blood sugar — go easy and ask your care team",
    flagBpTrend: "Your recent readings are trending up — extra reason to go easy on salt this week",
    pantryButton: "Find recipes in my pantry",
    pantryScanning: "Reading your pantry…",
    pantryDetectedTitle: "In your pantry",
    pantryRecipesTitle: "Recipe ideas",
    pantryToBuyLabel: "To pick up",
    pantryShoppingTitle: "Shopping list",
    pantryWatchLabel: "Heads up",
    pantryUnavailable: "I need the live camera model to read your pantry. Once it's set up, point the camera at your open pantry or fridge and tap Find recipes.",
    pantryNoFood: "I couldn't spot foods to build a recipe from. Try pointing the camera at your open pantry or fridge so I can see the items.",
    pantryLocked: "This demo needs its access code before it can read your pantry.",
    compassScoreLabel: "Food Compass score",
    compassBandEncourage: "Encourage",
    compassBandModerate: "Moderate",
    compassBandMinimize: "Minimize",
    compassEstimateBadge: "Estimate from label",
    compassEstimateNote: "Scored from the Nutrition Facts panel alone, so it is typically within about {mae} points and reads low: vitamins, food groups and phytochemicals are not printed on a label.",
    compassCalorieDensity: "Calorie density",
    compassDensityVeryLow: "Very low",
    compassDensityLow: "Low",
    compassDensityMedium: "Medium",
    compassDensityHigh: "High",
    compassDensityUnknown: "Serving weight unknown",
    compassBetterOptions: "Better options",
    compassAlreadyBest: "Already one of the best choices in its group.",
    compassNoCloseMatch: "No closer option with a higher score in this category.",
    compassRecipeLink: "Recipe ideas",
    compassCarveOutZeroCalorie: "Water is the best choice there is - it's outside this score's range.",
    compassCarveOutBelow5: "Under 5 calories per 100 g, so this sits outside the score's range.",
    compassCarveOutAlcohol: "Alcohol is outside this score's range.",
    compassCarveOutInfant: "Infant and baby foods are outside this score's range.",
    compassCarveOutSpecialized: "Specialized dietary foods are outside this score's range.",
    compassAmbiguous: "Published twice with different scores ({low} and {high}) - treat it as a range.",
    compassPointAtFood: "Point at a food",
    compassScoring: "Scoring...",
    compassMissingDomains: "Not scored from this label: {domains}",
    compassOutOf100: "out of 100"
  },
  es: {
    pageTitle: "Lente de Comida",
    navLabel: "Comida",
    viewfinderHint: "Apunta a una comida y pregunta.",
    scanHint: "Apunta a cualquier comida y pregunta.",
    statusConnecting: "Conectando…",
    statusListening: "Escuchando — solo habla.",
    statusThinking: "Pensando…",
    statusSpeaking: "Hablando…",
    statusIdle: "Toca empezar para hablar de esta comida.",
    statusIdleNoFood: "Toca empezar y describe tu comida.",
    statusError: "Algo salió mal.",
    tapToStart: "Empezar",
    endSession: "Terminar",
    resume: "Continuar",
    retry: "Intentar de nuevo",
    cameraRetry: "Reintentar cámara",
    scanAgain: "Escanear de nuevo",
    switchToTyped: "Cambiar a modo escrito",
    cameraDenied: "La cámara no está disponible en esta vista previa. Aún puedes usar los controles escritos abajo.",
    micDenied: "El acceso al micrófono está desactivado. Aún puedes escribir tu pregunta abajo.",
    cameraUnavailable: "La cámara no está disponible en esta vista previa. Aún puedes usar los controles escritos abajo.",
    fallbackNotice: "Escribe tu pregunta sobre lo que ves en la cámara y te respondo.",
    askPlaceholder: "Pregunta sobre esta comida…",
    askButton: "Preguntar",
    holdToTalkHint: "Di tu pregunta en voz alta.",
    liveTypedHint: "También puedes escribir mientras la conversación por voz está activa.",
    visionEstimateBadge: "Estimado por la foto",
    unknownFood: "Esta comida",
    portionAssuming: "Suponiendo {servings} porcion(es) - toca para cambiar.",
    portionSizeAssumption: "{size} ≈ {servings} porciones — ¿ajustar?",
    sizePersonal: "personal",
    sizeSmall: "pequeña",
    sizeMedium: "mediana",
    sizeRegular: "regular",
    sizeLarge: "grande",
    sizeExtraLarge: "extra grande",
    sizeFamily: "familiar",
    portionLabel: "Porciones",
    portionDecrease: "Disminuir porciones",
    portionIncrease: "Aumentar porciones",
    nutritionCalories: "Calorias",
    nutritionSodium: "Sodio",
    nutritionCarbs: "Carbohidratos",
    nutritionAddedSugars: "Azucares anadidos",
    logThis: "Guardar",
    loggedConfirmation: "Agregado a tus comidas",
    recentMealsTitle: "Comidas recientes",
    noMealsYet: "Aún no hay comidas guardadas.",
    foodNotThis: "¿No es esto?",
    weekInFoodTitle: "Semana de Comidas",
    weekMealsLogged: "{count} comidas registradas en los últimos 7 días",
    weekAverageItemScore: "promedio por alimento",
    weekBandMix: "Mezcla de categorías",
    weekBest: "Mejor: {food} ({score})",
    weekRoom: "Para mejorar: {food} ({score})",
    weekOpenFood: "Abrir Lente de Comida",
    postMealNudgeTitle: "Revisa tu azúcar en sangre",
    postMealNudgeBody: "Han pasado unas {hours} horas desde {food}; es un buen momento para revisar tu azúcar en sangre.",
    postMealNudgeCta: "Registrar una lectura",
    postMealNudgeDismiss: "Descartar",
    mealAteEarlier: "Comí esto más temprano",
    mealTimeReason: "La relación con una lectura después de comer usa la hora en que comiste.",
    mealThirtyMinutesAgo: "Hace 30 min",
    mealOneHourAgo: "Hace 1 h",
    mealTwoHoursAgo: "Hace 2 h",
    mealCustomTime: "Hora personalizada de la comida",
    mealSaveTime: "Guardar hora",
    mealTimePastError: "Elige una hora válida que no esté en el futuro.",
    mealDelete: "Eliminar",
    mealConfirmDelete: "Sí, eliminar",
    mealCancel: "Cancelar",
    betterOptionHint: "Pide una mejor opción.",
    flagSodium: "{amount} mg de sodio — {percent}% de tu límite diario de {limit} mg",
    flagSaturatedFat: "{amount} g de grasa saturada — {percent}% de tu límite diario de {limit} g",
    flagAddedSugars: "{amount} g de azúcares añadidos — {percent}% de tu límite diario de {limit} g",
    flagCarbs: "{amount} g de carbohidratos — {percent}% de tu referencia diaria de {limit} g",
    flagPotassiumGood: "{amount} mg de potasio — bueno para la presión arterial",
    flagFiberGood: "{amount} g de fibra — bueno para tu corazón",
    flagPotassiumMed: "Alto en potasio — consulta primero con tu equipo de salud porque tomas {med}",
    flagSaltSubstituteMed: "Esto es un sustituto de sal — consulta primero con tu equipo de salud porque tomas {med}",
    flagMetforminAlcohol: "El alcohol con {med} puede molestar tu estómago y afectar tu azúcar — ve con calma y consulta a tu equipo de salud",
    flagBpTrend: "Tus lecturas recientes están subiendo — una razón más para cuidar la sal esta semana",
    pantryButton: "Buscar recetas en mi despensa",
    pantryScanning: "Leyendo tu despensa…",
    pantryDetectedTitle: "En tu despensa",
    pantryRecipesTitle: "Ideas de recetas",
    pantryToBuyLabel: "Para comprar",
    pantryShoppingTitle: "Lista de compras",
    pantryWatchLabel: "Ojo",
    pantryUnavailable: "Necesito el modelo de cámara en vivo para leer tu despensa. Cuando esté configurado, apunta la cámara a tu despensa o refrigerador abierto y toca Buscar recetas.",
    pantryNoFood: "No pude ver alimentos para armar una receta. Intenta apuntar la cámara a tu despensa o refrigerador abierto para que vea los productos.",
    pantryLocked: "Esta demostración necesita su código de acceso antes de leer tu despensa.",
    compassScoreLabel: "Puntaje Food Compass",
    compassBandEncourage: "Recomendado",
    compassBandModerate: "Moderado",
    compassBandMinimize: "Limitar",
    compassEstimateBadge: "Estimado por la etiqueta",
    compassEstimateNote: "Calculado solo con la tabla nutricional, asi que suele estar a unos {mae} puntos y queda bajo: las vitaminas, los grupos de alimentos y los fitoquimicos no aparecen en la etiqueta.",
    compassCalorieDensity: "Densidad calorica",
    compassDensityVeryLow: "Muy baja",
    compassDensityLow: "Baja",
    compassDensityMedium: "Media",
    compassDensityHigh: "Alta",
    compassDensityUnknown: "Peso de la porcion desconocido",
    compassBetterOptions: "Mejores opciones",
    compassAlreadyBest: "Ya es una de las mejores opciones de su grupo.",
    compassNoCloseMatch: "No hay una opcion parecida con mejor puntaje en esta categoria.",
    compassRecipeLink: "Ideas de recetas",
    compassCarveOutZeroCalorie: "El agua es la mejor opcion que existe: queda fuera del rango de este puntaje.",
    compassCarveOutBelow5: "Menos de 5 calorias por 100 g, asi que queda fuera del rango del puntaje.",
    compassCarveOutAlcohol: "El alcohol queda fuera del rango de este puntaje.",
    compassCarveOutInfant: "Las formulas y papillas infantiles quedan fuera del rango de este puntaje.",
    compassCarveOutSpecialized: "Los alimentos dieteticos especializados quedan fuera del rango de este puntaje.",
    compassAmbiguous: "Publicado dos veces con puntajes distintos ({low} y {high}): tomalo como un rango.",
    compassPointAtFood: "Apunta a una comida",
    compassScoring: "Calculando...",
    compassMissingDomains: "No se calculo con esta etiqueta: {domains}",
    compassOutOf100: "de 100"
  }
};

export function t(language: Language, key: FoodLensStringKey, vars?: Record<string, string | number>): string {
  const template = foodLensStrings[language]?.[key] ?? foodLensStrings.en[key];
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

export type PrivacyStringKey =
  | "recordStorage"
  | "checkingTitle"
  | "checkingBody"
  | "onDeviceTitle"
  | "onDeviceBody"
  | "cloudTitle"
  | "cloudBody"
  | "liveTitle"
  | "liveBody"
  | "coachCheckingTitle"
  | "coachCheckingBody"
  | "coachOnDeviceTitle"
  | "coachOnDeviceBody"
  | "coachCloudTitle"
  | "coachCloudBody"
  | "coachLiveTitle"
  | "coachLiveBody"
  | "transcriptStored"
  | "deleteTitle"
  | "deleteBody"
  | "deleteConfirm"
  | "deleteCancel";

export const privacyStrings: Record<Language, Record<PrivacyStringKey, string>> = {
  en: {
    recordStorage: "Your saved demo record stays in this browser's storage until you export or delete it.",
    checkingTitle: "AI data use: not active",
    checkingBody: "No AI content has been sent. Start a session to see which data path is active.",
    onDeviceTitle: "AI mode: on-device",
    onDeviceBody: "Microphone audio is not sent to OpenAI. Questions are answered with the local demo coach.",
    cloudTitle: "AI mode: cloud service may be used",
    cloudBody: "When you use an AI feature, your question, current image, and relevant care context may be sent to OpenAI to create an answer.",
    liveTitle: "AI mode: live voice",
    liveBody: "Microphone audio, a current camera frame, and relevant food and care-plan context are sent to OpenAI while the session is active.",
    coachCheckingTitle: "Coach connection: checking",
    coachCheckingBody:
      "Checking whether the Coach's online connection is available. This status does not describe Ladder text.",
    coachOnDeviceTitle: "Coach: on-device",
    coachOnDeviceBody:
      "Coach microphone audio is not sent to OpenAI. Questions are answered with the local demo coach. This status does not describe Ladder text.",
    coachCloudTitle: "Coach text: cloud mode",
    coachCloudBody:
      "In the Coach, a question and relevant care context may be sent to OpenAI to create an answer. This status does not describe Ladder text.",
    coachLiveTitle: "Coach voice: live",
    coachLiveBody:
      "In the Coach, microphone audio and relevant care-plan context are sent to OpenAI while the session is active. This status does not describe Ladder text.",
    transcriptStored: "The final transcript and answer are added to your browser-stored demo record.",
    deleteTitle: "Delete demo data?",
    deleteBody: "This removes the saved demo record from this browser. Export first if you want to keep a copy.",
    deleteConfirm: "Yes, delete demo data",
    deleteCancel: "Cancel"
  },
  es: {
    recordStorage: "Tu registro de demostración guardado permanece en este navegador hasta que lo exportes o elimines.",
    checkingTitle: "Uso de datos de IA: no activo",
    checkingBody: "No se ha enviado contenido a la IA. Inicia una sesión para ver qué ruta de datos está activa.",
    onDeviceTitle: "Modo de IA: en el dispositivo",
    onDeviceBody: "El audio del micrófono no se envía a OpenAI. Las preguntas se responden con el asistente local de demostración.",
    cloudTitle: "Modo de IA: puede usar un servicio en la nube",
    cloudBody: "Cuando usas una función de IA, tu pregunta, la imagen actual y el contexto de salud relevante pueden enviarse a OpenAI para crear una respuesta.",
    liveTitle: "Modo de IA: voz en vivo",
    liveBody: "El audio del micrófono, una imagen actual de la cámara y el contexto relevante de comida y del plan de salud se envían a OpenAI mientras la sesión está activa.",
    coachCheckingTitle: "Conexión del asistente: comprobando",
    coachCheckingBody:
      "Estamos comprobando si la conexión en línea del asistente está disponible. Este estado no describe el texto de Ladder.",
    coachOnDeviceTitle: "Asistente: en el dispositivo",
    coachOnDeviceBody:
      "El audio del micrófono del asistente no se envía a OpenAI. Las preguntas se responden con el asistente local de demostración. Este estado no describe el texto de Ladder.",
    coachCloudTitle: "Texto del asistente: modo en la nube",
    coachCloudBody:
      "En el asistente, una pregunta y el contexto de salud relevante pueden enviarse a OpenAI para crear una respuesta. Este estado no describe el texto de Ladder.",
    coachLiveTitle: "Voz del asistente: en vivo",
    coachLiveBody:
      "En el asistente, el audio del micrófono y el contexto relevante del plan de salud se envían a OpenAI mientras la sesión está activa. Este estado no describe el texto de Ladder.",
    transcriptStored: "La transcripción final y la respuesta se agregan a tu registro de demostración guardado en el navegador.",
    deleteTitle: "¿Eliminar los datos de demostración?",
    deleteBody: "Esto elimina de este navegador el registro de demostración guardado. Expórtalo primero si quieres conservar una copia.",
    deleteConfirm: "Sí, eliminar los datos",
    deleteCancel: "Cancelar"
  }
};

export function tPrivacy(language: Language, key: PrivacyStringKey): string {
  return privacyStrings[language]?.[key] ?? privacyStrings.en[key];
}

export type SafetyStringKey =
  | "crisisResponse"
  | "abuseResponse"
  | "harmToOthersResponse"
  | "crisisCall988"
  | "crisisText988"
  | "callEmergency"
  | "safetyPlanLabel"
  | "safetyPlanBody"
  | "crisisAcknowledge"
  | "emergencyResponseSuffix"
  | "groundingFallback"
  | "groundingFallbackBanner"
  | "voiceInterceptNotice"
  | "socialEmergencyResponse"
  | "urgentHelpSummary";

export const safetyStrings: Record<Language, Record<SafetyStringKey, string>> = {
  en: {
    crisisResponse:
      "It sounds like you may be going through something very painful right now, and you deserve real support from a person. This is more than I can help with safely on my own. Please reach out right now: call or text 988 to reach the Suicide & Crisis Lifeline — it is free, confidential, and open every hour of every day. If you are in immediate danger, call 911. You are not alone, and help is available.",
    abuseResponse:
      "A person trained to help with child safety should be involved right now. If anyone is in immediate danger, call 911. You can also call or text 988 and contact your care team for human help.",
    harmToOthersResponse:
      "Keeping everyone safe comes first. If anyone is in immediate danger, call 911 now. For urgent concerns about your child's behavior, you can go to the nearest emergency department, and you can call or text 988 — they also help people who are worried about someone else. Please tell your child's pediatrician what is happening. When you're ready, we can keep looking for support programs together.",
    crisisCall988: "Call 988 — Crisis Lifeline",
    crisisText988: "Text 988",
    callEmergency: "Call 911",
    safetyPlanLabel: "A few steps that can help right now",
    safetyPlanBody:
      "You do not have to face this by yourself. If you can, tell someone you trust what is happening. Move to a safer space and put anything you could use to hurt yourself out of reach. Stay on the line with 988 — they will stay with you. If things feel unsafe, call 911.",
    crisisAcknowledge: "I've seen this — continue",
    emergencyResponseSuffix:
      "If this may be a medical emergency, call 911 now. I can help you share what is happening with your care team.",
    groundingFallback:
      "I could not confirm that answer against your own records, so I do not want to guess. Please contact your care team and they can help with this directly.",
    groundingFallbackBanner: "This answer was replaced because it was not backed by your records.",
    voiceInterceptNotice: "I paused here for your safety.",
    socialEmergencyResponse:
      "It sounds like you may be without something you need today, like food or medicine. If this is an emergency, call 911. You can also dial 211 any time to reach someone who can help connect you with food, housing, or utility support right now.",
    urgentHelpSummary: "Feeling unsafe right now? Get help"
  },
  es: {
    crisisResponse:
      "Parece que estás pasando por algo muy doloroso ahora mismo, y mereces apoyo real de una persona. Esto es más de lo que puedo ayudar de forma segura por mi cuenta. Por favor, busca ayuda ahora mismo: llama o envía un mensaje de texto al 988 para comunicarte con la Línea de Crisis y Suicidio — es gratis, confidencial y está disponible a toda hora, todos los días. Si estás en peligro inmediato, llama al 911. No estás solo, y hay ayuda disponible.",
    abuseResponse:
      "Una persona capacitada para ayudar con la seguridad de menores debe participar ahora mismo. Si alguien est\u00e1 en peligro inmediato, llama al 911. Tambi\u00e9n puedes llamar o enviar un mensaje de texto al 988 y comunicarte con tu equipo de salud para obtener ayuda humana.",
    harmToOthersResponse:
      "La seguridad de todos es lo primero. Si alguien est\u00e1 en peligro inmediato, llama al 911 ahora. Si te preocupa mucho el comportamiento de tu hijo o hija, puedes ir a la sala de emergencias m\u00e1s cercana, y tambi\u00e9n puedes llamar o enviar un mensaje de texto al 988 \u2014 tambi\u00e9n ayudan a quienes est\u00e1n preocupados por otra persona. Por favor, cu\u00e9ntale al pediatra de tu hijo o hija lo que est\u00e1 pasando. Cuando est\u00e9s listo, podemos seguir buscando programas de apoyo juntos.",
    crisisCall988: "Llama al 988 — Línea de Crisis",
    crisisText988: "Envía un texto al 988",
    callEmergency: "Llama al 911",
    safetyPlanLabel: "Unos pasos que pueden ayudar ahora mismo",
    safetyPlanBody:
      "No tienes que enfrentar esto solo. Si puedes, dile a alguien de confianza lo que está pasando. Ve a un lugar más seguro y aleja cualquier cosa que podrías usar para lastimarte. Quédate en la línea con el 988 — se quedarán contigo. Si algo se siente inseguro, llama al 911.",
    crisisAcknowledge: "Ya lo vi — continuar",
    emergencyResponseSuffix:
      "Si esto puede ser una emergencia médica, llama al 911 ahora. Puedo ayudarte a compartir lo que está pasando con tu equipo de salud.",
    groundingFallback:
      "No pude confirmar esa respuesta con tus propios registros, así que no quiero adivinar. Por favor, comunícate con tu equipo de salud y ellos pueden ayudarte con esto directamente.",
    groundingFallbackBanner: "Esta respuesta fue reemplazada porque no estaba respaldada por tus registros.",
    voiceInterceptNotice: "Hice una pausa aquí por tu seguridad.",
    socialEmergencyResponse:
      "Parece que hoy podrías estar sin algo que necesitas, como comida o medicina. Si esto es una emergencia, llama al 911. También puedes llamar al 211 en cualquier momento para comunicarte con alguien que pueda ayudarte a conectar con apoyo de comida, vivienda o servicios ahora mismo.",
    urgentHelpSummary: "¿Te sientes inseguro ahora? Busca ayuda"
  }
};

export function tSafety(language: Language, key: SafetyStringKey, vars?: Record<string, string | number>): string {
  const template = safetyStrings[language]?.[key] ?? safetyStrings.en[key];
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

// Diabetic-retinopathy screening pathway copy. The five grade strings are the
// LOCKED plain-language table from docs/plans/09 — grounding-safe ("Your report
// says…", never "You have…"), calm at every urgency level, equal urgency in es.
export type ScreeningStringKey =
  | "pageTitle"
  | "gradeNoDr"
  | "gradeMild"
  | "gradeModerateSevere"
  | "gradeDmePdr"
  | "gradeUngradable"
  | "nudgeSmsHeader"
  | "nudgeSeeTimes"
  | "nudgeTalkInstead"
  | "nudgeCallbackTitle"
  | "nudgeCallbackBody"
  | "findTitle"
  | "findIntro"
  | "zipLabel"
  | "zipBasedOn"
  | "zipUnknown"
  | "recommendedTitle"
  | "bookIt"
  | "recommendationLine"
  | "seeOtherOptions"
  | "hideOtherOptions"
  | "modeBest"
  | "modeFastest"
  | "modeClosest"
  | "equityNudge"
  | "rideSupportBadge"
  | "lowCostBadge"
  | "matchLeadBest"
  | "matchLeadFastest"
  | "matchLeadClosest"
  | "matchPartDistance"
  | "matchPartOpen"
  | "matchPartRide"
  | "matchPartLowCost"
  | "venueFqhc"
  | "venueMobile"
  | "venueCommunityCamera"
  | "venueEyeClinic"
  | "venueKroger"
  | "venuePharmacy"
  | "venuePrimaryCare"
  | "coverageTitle"
  | "coverageEstimated"
  | "coverageRide"
  | "bookedTitle"
  | "bookedLine"
  | "whatToExpectTitle"
  | "whatToExpectBody"
  | "rideQuestion"
  | "rideYes"
  | "rideNo"
  | "rideSiteCovered"
  | "rideResourcesTitle"
  | "tileEyeCheckTitle"
  | "tileEyeCheckBody"
  | "tileEyeCheckCta"
  | "allCaughtUp"
  | "bookedSnapCta"
  | "resultPageTitle"
  | "captureBoundary"
  | "captureIntroTitle"
  | "captureIntroBody"
  | "captureStart"
  | "capturePhotoLabel"
  | "captureTypeInstead"
  | "captureDemoTitle"
  | "captureDemoHint"
  | "captureTypedLabel"
  | "captureTypedPlaceholder"
  | "captureTypedSubmit"
  | "reviewTitle"
  | "reviewDmeYes"
  | "reviewDmeNo"
  | "reviewDmeUnknown"
  | "reviewFieldsTitle"
  | "confirmRight"
  | "confirmWrong"
  | "refusalUnreadable"
  | "refusalRetinalPhoto"
  | "refusalNotAReport"
  | "refusalTryAgain"
  | "provenancePhoto"
  | "provenanceTyped"
  | "resultTitle"
  | "resultNeedBooking"
  | "resultNeedBookingCta"
  | "seeLatestResult"
  | "stageNoteDrafted"
  | "stageNoteSent"
  | "referralWentTo"
  | "kindOptometrist"
  | "kindRetina"
  | "stageDrafted"
  | "stageSent"
  | "stageConfirmed"
  | "stageScheduled"
  | "stageCompleted"
  | "stalledNotice"
  | "urgentBannerTitle"
  | "urgentBannerBody"
  | "packetOpen"
  | "packetTitle"
  | "packetPatient"
  | "packetResult"
  | "packetUrgency"
  | "packetUrgencyRoutine"
  | "packetUrgencyUrgent"
  | "packetDestination"
  | "packetScreenedAt"
  | "packetWatermark"
  | "packetFootnote"
  | "packetPrint"
  | "careTeamDraftTitle"
  | "careTeamDraftHint"
  | "stageNoteStalled"
  | "stageNoteConfirmed"
  | "simulateDays"
  | "clinicCalledCta"
  | "recallLine"
  | "recallMildEmphasis"
  | "rebookNow"
  | "slotPickerTitle"
  | "slotBookedNote"
  | "bookedForLine"
  | "rideReAsk"
  | "wentCta"
  | "completedNote"
  | "teachBridge"
  | "teachCtaGlucose"
  | "teachCtaFood"
  | "teachCtaMeds"
  | "lensTitle"
  | "lensDue"
  | "lensBooked"
  | "lensRepeat"
  | "lensReferred"
  | "lensAllClear"
  | "journeyTitle"
  | "journeyScreened"
  | "journeyReferralSent"
  | "journeyAwaitingSchedule"
  | "journeyScheduled"
  | "journeyCompleted"
  | "coachReportAnswer";

export const screeningStrings: Record<Language, Record<ScreeningStringKey, string>> = {
  en: {
    pageTitle: "Eye Check",
    gradeNoDr: "Your report says no signs of diabetic eye disease were found.",
    gradeMild:
      "Your report shows mild early changes. No specialist visit is needed now — a repeat photo in 12 months keeps watch.",
    gradeModerateSevere:
      "Your report shows changes that need a closer look by an eye doctor. This is common and treatable when caught early.",
    gradeDmePdr:
      "Your report shows changes that need care soon. Getting seen quickly protects your vision. Your referral has already been sent.",
    gradeUngradable:
      "The image could not be read clearly, which happens sometimes. A quick repeat screening is all that is needed.",
    nudgeSmsHeader: "Text message · today",
    nudgeSeeTimes: "See times near me",
    nudgeTalkInstead: "I'd rather talk to someone",
    nudgeCallbackTitle: "A message for your care team is ready",
    nudgeCallbackBody:
      "No queue, no hold music. Copy this message or show it at your clinic, and someone will call you back about your eye check.",
    findTitle: "Find a screening near you",
    findIntro: "A quick photo of your eyes — no appointment with a specialist needed to get checked.",
    zipLabel: "Your ZIP code",
    zipBasedOn: "Based on your ZIP {zip}, here are {count} screening options near you.",
    zipUnknown: "Showing the closest demo locations to that ZIP. Distances are straight-line estimates.",
    recommendedTitle: "Recommended for you",
    bookIt: "Book it",
    recommendationLine: "{when} at {site}, {miles} mi",
    seeOtherOptions: "See other options",
    hideOtherOptions: "Hide other options",
    modeBest: "Best match",
    modeFastest: "Fastest",
    modeClosest: "Closest",
    equityNudge:
      "Nearest eye specialist: about {eyeMiles} mi. Nearest screening camera: about {cameraMiles} mi. A camera close to home closes the gap without the long drive.",
    rideSupportBadge: "Ride support",
    lowCostBadge: "Low-cost",
    matchLeadBest: "Best match because {parts}.",
    matchLeadFastest: "Fastest option because {parts}.",
    matchLeadClosest: "Closest option because {parts}.",
    matchPartDistance: "it is {miles} miles away",
    matchPartOpen: "open {when}",
    matchPartRide: "has ride support",
    matchPartLowCost: "is low-cost",
    venueFqhc: "Community health center",
    venueMobile: "Mobile camera",
    venueCommunityCamera: "Community camera",
    venueEyeClinic: "Eye clinic",
    venueKroger: "Kroger",
    venuePharmacy: "Pharmacy",
    venuePrimaryCare: "Primary care office",
    coverageTitle: "Coverage & ride check",
    coverageEstimated: "Estimated: {cost}",
    coverageRide: "Ride help: {ride}",
    bookedTitle: "You're booked",
    bookedLine: "Eye screening — {site}, {when}",
    whatToExpectTitle: "What to expect",
    whatToExpectBody: "About 10 minutes. Usually no dilation. No air puff. You'll know before you leave.",
    rideQuestion: "Do you have a way to get there?",
    rideYes: "Yes, I have a ride",
    rideNo: "I need help with a ride",
    rideSiteCovered: "This site offers ride support — say so when they confirm your visit and they will set it up.",
    rideResourcesTitle: "Transportation help near you",
    tileEyeCheckTitle: "Eye check due",
    tileEyeCheckBody: "It's been {months} months since your last diabetes eye photo. A new one takes about 10 minutes, close to home.",
    tileEyeCheckCta: "See times near me",
    allCaughtUp: "No eye screening is due right now. We'll remind you when your next one comes up.",
    bookedSnapCta: "I had my screening — read my report",
    resultPageTitle: "Your screening report",
    captureBoundary: "I read the printed report only — I can't check your eyes or give a diagnosis.",
    captureIntroTitle: "Photograph the printed report",
    captureIntroBody:
      "After your screening, the camera prints a one-page report. Photograph that sheet in good light with all four corners in the frame — the app reads the sheet and you confirm every word before anything is saved.",
    captureStart: "Read my report",
    capturePhotoLabel: "Photo of the printed report",
    captureTypeInstead: "Type it instead",
    captureDemoTitle: "Or pick a demo report",
    captureDemoHint: "Bundled sample sheets for the walkthrough — watermarked, not medical documents.",
    captureTypedLabel: "What does the report say?",
    captureTypedPlaceholder: "e.g. \"moderate, no macular edema\" or \"ungradable\"",
    captureTypedSubmit: "Read my entry",
    reviewTitle: "Here's what I read from your report:",
    reviewDmeYes: "Macular edema (DME): the report marks it present.",
    reviewDmeNo: "Macular edema (DME): not detected.",
    reviewDmeUnknown: "Macular edema (DME): not stated.",
    reviewFieldsTitle: "Lines I read from the sheet",
    confirmRight: "That's right",
    confirmWrong: "That's not right",
    refusalUnreadable:
      "I couldn't read that clearly, so I won't guess. Try a straighter photo in better light, or type what the report says.",
    refusalRetinalPhoto:
      "I can only read the printed report, not eye photos. Photograph the report sheet the camera printed for you.",
    refusalNotAReport: "That doesn't look like a screening report. Photograph the printed report sheet, or type what it says.",
    refusalTryAgain: "Try again",
    provenancePhoto: "From your report photo — confirmed by you",
    provenanceTyped: "From your typed entry — confirmed by you",
    resultTitle: "Your result",
    resultNeedBooking: "Book your screening first — then bring the printed report back here.",
    resultNeedBookingCta: "Find a screening",
    seeLatestResult: "See your latest result",
    stageNoteDrafted: "Drafted from your confirmed report",
    stageNoteSent: "Sent to {name}",
    referralWentTo: "Your referral went to {name} ({kind}), {miles} mi — expect a call within {days} days.",
    kindOptometrist: "Optometrist",
    kindRetina: "Retina specialist",
    stageDrafted: "Drafted",
    stageSent: "Sent",
    stageConfirmed: "Clinic confirmed",
    stageScheduled: "Scheduled",
    stageCompleted: "Done",
    stalledNotice: "We're on it — your care team has been notified.",
    urgentBannerTitle: "Needs care soon",
    urgentBannerBody:
      "Your referral has already been sent. Getting seen quickly protects your vision — you don't need to figure this out alone.",
    packetOpen: "View referral packet",
    packetTitle: "Referral packet",
    packetPatient: "Patient",
    packetResult: "Report result",
    packetUrgency: "Urgency",
    packetUrgencyRoutine: "Routine — optometry",
    packetUrgencyUrgent: "Urgent — retina service",
    packetDestination: "Sent to",
    packetScreenedAt: "Screening",
    packetWatermark: "DEMO PACKET",
    packetFootnote: "A real referral would also include: insurance card copy, PCP signature, image files.",
    packetPrint: "Print",
    careTeamDraftTitle: "Message for your care team",
    careTeamDraftHint: "Ready to copy or show at your clinic — nothing is sent by the app.",
    stageNoteStalled: "No confirmation call inside the expected window",
    stageNoteConfirmed: "You told us the clinic called",
    simulateDays: "Demo: simulate {days} days passing",
    clinicCalledCta: "They called me — it's confirmed",
    recallLine: "We'll remind you in {monthYear}.",
    recallMildEmphasis: "Because early changes were seen, steady daily care matters even more this year.",
    rebookNow: "Rebook now",
    slotPickerTitle: "Or pick a time now:",
    slotBookedNote: "Booked {when} at {name}",
    bookedForLine: "Booked: {when}",
    rideReAsk: "Need a ride that day?",
    wentCta: "I went to this appointment",
    completedNote: "Self-reported by you",
    teachBridge: "The same blood sugar that affects your eyes responds to daily care. Small steps protect your sight.",
    teachCtaGlucose: "My Blood Sugar",
    teachCtaFood: "Check a food",
    teachCtaMeds: "My medicines",
    lensTitle: "Your diabetes eye care",
    lensDue: "Eye check due — it's been {months} months since your last photo.",
    lensBooked: "Eye screening booked — {site}, {when}.",
    lensRepeat: "A quick repeat screening is needed — the last photo couldn't be read.",
    lensReferred: "Referral in motion with {name}.",
    lensAllClear: "Eyes all clear until {monthYear}.",
    journeyTitle: "Your eye-care loop",
    journeyScreened: "Screened {date}",
    journeyReferralSent: "Referral sent",
    journeyAwaitingSchedule: "Scheduling — expect the clinic's call",
    journeyScheduled: "Scheduled {when}",
    journeyCompleted: "Completed",
    coachReportAnswer: "Your report from {date} says: {gradeCopy}"
  },
  es: {
    pageTitle: "Chequeo de Ojos",
    gradeNoDr: "Tu reporte dice que no se encontraron señales de enfermedad diabética del ojo.",
    gradeMild:
      "Tu reporte muestra cambios leves y tempranos. No se necesita una visita al especialista ahora — una nueva foto en 12 meses mantiene la vigilancia.",
    gradeModerateSevere:
      "Tu reporte muestra cambios que necesitan una revisión más de cerca por un doctor de los ojos. Esto es común y tratable cuando se detecta a tiempo.",
    gradeDmePdr:
      "Tu reporte muestra cambios que necesitan atención pronto. Que te atiendan rápido protege tu visión. Tu referido ya fue enviado.",
    gradeUngradable:
      "La imagen no se pudo leer con claridad, lo cual pasa a veces. Solo se necesita repetir el examen rápidamente.",
    nudgeSmsHeader: "Mensaje de texto · hoy",
    nudgeSeeTimes: "Ver horarios cerca de mí",
    nudgeTalkInstead: "Prefiero hablar con alguien",
    nudgeCallbackTitle: "Un mensaje para tu equipo de salud está listo",
    nudgeCallbackBody:
      "Sin filas ni música de espera. Copia este mensaje o muéstralo en tu clínica, y alguien te llamará sobre tu chequeo de ojos.",
    findTitle: "Encuentra un examen cerca de ti",
    findIntro: "Una foto rápida de tus ojos — no necesitas cita con un especialista para hacerte el chequeo.",
    zipLabel: "Tu código postal",
    zipBasedOn: "Según tu código postal {zip}, hay {count} opciones de examen cerca de ti.",
    zipUnknown: "Mostrando las ubicaciones de demostración más cercanas a ese código. Las distancias son estimaciones en línea recta.",
    recommendedTitle: "Recomendado para ti",
    bookIt: "Reservar",
    recommendationLine: "{when} en {site}, a {miles} millas",
    seeOtherOptions: "Ver otras opciones",
    hideOtherOptions: "Ocultar otras opciones",
    modeBest: "Mejor opción",
    modeFastest: "Más rápida",
    modeClosest: "Más cercana",
    equityNudge:
      "El especialista de ojos más cercano: a unas {eyeMiles} millas. La cámara de examen más cercana: a unas {cameraMiles} millas. Una cámara cerca de casa cierra la brecha sin el viaje largo.",
    rideSupportBadge: "Apoyo con transporte",
    lowCostBadge: "Bajo costo",
    matchLeadBest: "Mejor opción porque {parts}.",
    matchLeadFastest: "Opción más rápida porque {parts}.",
    matchLeadClosest: "Opción más cercana porque {parts}.",
    matchPartDistance: "está a {miles} millas",
    matchPartOpen: "abre {when}",
    matchPartRide: "tiene apoyo con transporte",
    matchPartLowCost: "es de bajo costo",
    venueFqhc: "Centro de salud comunitario",
    venueMobile: "Cámara móvil",
    venueCommunityCamera: "Cámara comunitaria",
    venueEyeClinic: "Clínica de ojos",
    venueKroger: "Kroger",
    venuePharmacy: "Farmacia",
    venuePrimaryCare: "Consultorio de atención primaria",
    coverageTitle: "Chequeo de cobertura y transporte",
    coverageEstimated: "Estimado: {cost}",
    coverageRide: "Ayuda con transporte: {ride}",
    bookedTitle: "Tu cita está reservada",
    bookedLine: "Examen de ojos — {site}, {when}",
    whatToExpectTitle: "Qué esperar",
    whatToExpectBody: "Unos 10 minutos. Normalmente sin dilatación. Sin soplo de aire. Sabrás el resultado antes de irte.",
    rideQuestion: "¿Tienes cómo llegar?",
    rideYes: "Sí, tengo transporte",
    rideNo: "Necesito ayuda con el transporte",
    rideSiteCovered: "Este lugar ofrece apoyo con transporte — dilo cuando confirmen tu visita y lo organizarán.",
    rideResourcesTitle: "Ayuda de transporte cerca de ti",
    tileEyeCheckTitle: "Chequeo de ojos pendiente",
    tileEyeCheckBody: "Han pasado {months} meses desde tu última foto de ojos por la diabetes. Una nueva toma unos 10 minutos, cerca de casa.",
    tileEyeCheckCta: "Ver horarios cerca de mí",
    allCaughtUp: "No tienes ningún examen de ojos pendiente por ahora. Te recordaremos cuando toque el próximo.",
    bookedSnapCta: "Ya me hice el examen — leer mi reporte",
    resultPageTitle: "Tu reporte del examen",
    captureBoundary: "Solo leo el reporte impreso — no puedo revisar tus ojos ni dar un diagnóstico.",
    captureIntroTitle: "Fotografía el reporte impreso",
    captureIntroBody:
      "Después de tu examen, la cámara imprime un reporte de una página. Fotografía esa hoja con buena luz y las cuatro esquinas en el cuadro — la app lee la hoja y tú confirmas cada palabra antes de guardar nada.",
    captureStart: "Leer mi reporte",
    capturePhotoLabel: "Foto del reporte impreso",
    captureTypeInstead: "Escribirlo en su lugar",
    captureDemoTitle: "O elige un reporte de demostración",
    captureDemoHint: "Hojas de muestra incluidas para el recorrido — con marca de agua, no son documentos médicos.",
    captureTypedLabel: "¿Qué dice el reporte?",
    captureTypedPlaceholder: "p. ej. \"moderate, no macular edema\" o \"ungradable\"",
    captureTypedSubmit: "Leer mi texto",
    reviewTitle: "Esto es lo que leí de tu reporte:",
    reviewDmeYes: "Edema macular (DME): el reporte lo marca presente.",
    reviewDmeNo: "Edema macular (DME): no detectado.",
    reviewDmeUnknown: "Edema macular (DME): no indicado.",
    reviewFieldsTitle: "Líneas que leí de la hoja",
    confirmRight: "Así es",
    confirmWrong: "No es correcto",
    refusalUnreadable:
      "No pude leerlo con claridad, así que no voy a adivinar. Intenta una foto más derecha con mejor luz, o escribe lo que dice el reporte.",
    refusalRetinalPhoto:
      "Solo puedo leer el reporte impreso, no fotos de ojos. Fotografía la hoja del reporte que imprimió la cámara.",
    refusalNotAReport: "Eso no parece un reporte de examen. Fotografía la hoja impresa del reporte, o escribe lo que dice.",
    refusalTryAgain: "Intentar de nuevo",
    provenancePhoto: "De la foto de tu reporte — confirmado por ti",
    provenanceTyped: "De tu texto escrito — confirmado por ti",
    resultTitle: "Tu resultado",
    resultNeedBooking: "Primero reserva tu examen — luego trae aquí el reporte impreso.",
    resultNeedBookingCta: "Buscar un examen",
    seeLatestResult: "Ver tu último resultado",
    stageNoteDrafted: "Preparado a partir de tu reporte confirmado",
    stageNoteSent: "Enviado a {name}",
    referralWentTo: "Tu referido fue a {name} ({kind}), a {miles} millas — espera una llamada dentro de {days} días.",
    kindOptometrist: "Optometrista",
    kindRetina: "Especialista de retina",
    stageDrafted: "Preparado",
    stageSent: "Enviado",
    stageConfirmed: "Clínica confirmó",
    stageScheduled: "Agendado",
    stageCompleted: "Hecho",
    stalledNotice: "Estamos en esto — tu equipo de salud ya fue notificado.",
    urgentBannerTitle: "Necesita atención pronto",
    urgentBannerBody:
      "Tu referido ya fue enviado. Que te atiendan rápido protege tu visión — no tienes que resolver esto por tu cuenta.",
    packetOpen: "Ver paquete de referido",
    packetTitle: "Paquete de referido",
    packetPatient: "Paciente",
    packetResult: "Resultado del reporte",
    packetUrgency: "Urgencia",
    packetUrgencyRoutine: "Rutina — optometría",
    packetUrgencyUrgent: "Urgente — servicio de retina",
    packetDestination: "Enviado a",
    packetScreenedAt: "Examen",
    packetWatermark: "PAQUETE DE DEMOSTRACIÓN",
    packetFootnote: "Un referido real también incluiría: copia de la tarjeta del seguro, firma del médico primario, archivos de imágenes.",
    packetPrint: "Imprimir",
    careTeamDraftTitle: "Mensaje para tu equipo de salud",
    careTeamDraftHint: "Listo para copiar o mostrar en tu clínica — la app no envía nada.",
    stageNoteStalled: "Sin llamada de confirmación dentro del plazo esperado",
    stageNoteConfirmed: "Nos dijiste que la clínica llamó",
    simulateDays: "Demo: simular que pasan {days} días",
    clinicCalledCta: "Ya me llamaron — está confirmado",
    recallLine: "Te recordaremos en {monthYear}.",
    recallMildEmphasis: "Como se vieron cambios tempranos, el cuidado diario constante importa aún más este año.",
    rebookNow: "Reservar de nuevo ahora",
    slotPickerTitle: "O elige un horario ahora:",
    slotBookedNote: "Reservado {when} en {name}",
    bookedForLine: "Reservado: {when}",
    rideReAsk: "¿Necesitas transporte ese día?",
    wentCta: "Fui a esta cita",
    completedNote: "Reportado por ti",
    teachBridge: "La misma azúcar en sangre que afecta tus ojos responde al cuidado diario. Pasos pequeños protegen tu vista.",
    teachCtaGlucose: "Mi Azúcar en Sangre",
    teachCtaFood: "Revisar una comida",
    teachCtaMeds: "Mis medicinas",
    lensTitle: "Tu cuidado de ojos por la diabetes",
    lensDue: "Chequeo de ojos pendiente — han pasado {months} meses desde tu última foto.",
    lensBooked: "Examen de ojos reservado — {site}, {when}.",
    lensRepeat: "Se necesita repetir el examen rápidamente — la última foto no se pudo leer.",
    lensReferred: "Referido en marcha con {name}.",
    lensAllClear: "Ojos sin novedades hasta {monthYear}.",
    journeyTitle: "Tu ciclo de cuidado de ojos",
    journeyScreened: "Examinado el {date}",
    journeyReferralSent: "Referido enviado",
    journeyAwaitingSchedule: "Agendando — espera la llamada de la clínica",
    journeyScheduled: "Agendado {when}",
    journeyCompleted: "Completado",
    coachReportAnswer: "Tu reporte del {date} dice: {gradeCopy}"
  }
};

export function tScreening(language: Language, key: ScreeningStringKey, vars?: Record<string, string | number>): string {
  const template = screeningStrings[language]?.[key] ?? screeningStrings.en[key];
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}
