import type { Language } from "./strings";

export type FamilyStringKey =
  | "pageTitle"
  | "demoBadge"
  | "intro"
  | "spanishReviewNotice"
  | "setupTitle"
  | "setupIntro"
  | "profileCountyLabel"
  | "profileCountyPlaceholder"
  | "profileChildNameLabel"
  | "profileChildNamePlaceholder"
  | "profileBirthYearLabel"
  | "profileBirthYearPlaceholder"
  | "profileBirthMonthLabel"
  | "profileBirthMonthOptional"
  | "profileSchoolStageLabel"
  | "profileDiagnosesLabel"
  | "profileDiagnosisDateLabel"
  | "profileOtherDiagnosisLabel"
  | "profileOtherDiagnosisPlaceholder"
  | "profileSave"
  | "profileSaved"
  | "profileEdit"
  | "profileBirthYearError"
  | "profileBirthMonthError"
  | "profileOtherDiagnosisError"
  | "diagnosisAutism"
  | "diagnosisAdhd"
  | "diagnosisDyslexia"
  | "diagnosisSpeechLanguage"
  | "diagnosisDevelopmentalDelay"
  | "diagnosisIntellectualDisability"
  | "diagnosisDownSyndrome"
  | "diagnosisOther"
  | "diagnosisAdd"
  | "diagnosisRemove"
  | "schoolNotSchoolAge"
  | "schoolPreschool"
  | "schoolElementary"
  | "schoolMiddle"
  | "schoolHigh"
  | "schoolPostHigh"
  | "screenTitle"
  | "screenIntro"
  | "screenEarlyIntervention"
  | "screenTherapies"
  | "screenSchoolIep"
  | "screenWaiversFinancial"
  | "screenRespite"
  | "screenParentSupport"
  | "screenSiblingSupport"
  | "screenTransportation"
  | "answerYes"
  | "answerNo"
  | "answerDeclined"
  | "screenSubmit"
  | "screenSaved"
  | "domainEarlyIntervention"
  | "domainTherapies"
  | "domainSchoolIep"
  | "domainWaiversFinancial"
  | "domainRespite"
  | "domainParentSupport"
  | "domainSiblingSupport"
  | "domainTransportation"
  | "domainFuturePlanning"
  | "domainDiagnosisEducation"
  | "domainRecreation"
  | "interviewTitle"
  | "interviewIntro"
  | "interviewLabel"
  | "interviewPlaceholder"
  | "interviewMicStart"
  | "interviewMicStop"
  | "interviewMicDone"
  | "interviewListening"
  | "interviewReconnecting"
  | "interviewFinished"
  | "interviewStopped"
  | "interviewSubmit"
  | "interviewWorking"
  | "interviewErrorTooShort"
  | "interviewErrorTooLong"
  | "interviewErrorUnavailable"
  | "interviewErrorFallback"
  | "interviewCount"
  | "interviewSafetyRedirect"
  | "interviewSafetyRedirectTitle"
  | "interviewSafetyRedirectBody"
  | "followUpSchoolIepQuestion"
  | "followUpSchoolIepChip1"
  | "followUpSchoolIepChip2"
  | "followUpSchoolIepChip3"
  | "followUpTherapiesQuestion"
  | "followUpTherapiesChip1"
  | "followUpTherapiesChip2"
  | "followUpTherapiesChip3"
  | "followUpWaiversQuestion"
  | "followUpWaiversChip1"
  | "followUpWaiversChip2"
  | "followUpWaiversChip3"
  | "followUpRespiteQuestion"
  | "followUpRespiteChip1"
  | "followUpRespiteChip2"
  | "followUpRespiteChip3"
  | "followUpGenericDayQuestion"
  | "followUpGenericDayChip1"
  | "followUpGenericDayChip2"
  | "followUpGenericDayChip3"
  | "followUpGenericHelpQuestion"
  | "followUpGenericHelpChip1"
  | "followUpGenericHelpChip2"
  | "followUpGenericHelpChip3"
  | "orientationRoundCount"
  | "followUpChipsLabel"
  | "followUpAnswerLabel"
  | "followUpAnswerPlaceholder"
  | "followUpAnswerSubmit"
  | "followUpAnswerError"
  | "orientationComplete"
  | "orientationStartOver"
  | "factsTitle"
  | "factsIntro"
  | "evidencePatientReported"
  | "evidenceInferred"
  | "evidenceConfirmed"
  | "factSource"
  | "factConfirm"
  | "factConfirmed"
  | "needsScreenDisclosureTitle"
  | "needsScreenDisclosureBody"
  | "domainRationaleTitle"
  | "factGradeLabel"
  | "factReportedDiagnosisLabel"
  | "factConcernSchoolLabel"
  | "factConcernSchoolValue"
  | "factConcernSpeechLabel"
  | "factConcernSpeechValue"
  | "factConcernBehaviorLabel"
  | "factConcernBehaviorValue"
  | "factConcernMotorLabel"
  | "factConcernMotorValue"
  | "rationaleEarlyIntervention"
  | "rationaleTherapies"
  | "rationaleSchoolIep"
  | "rationaleWaiversFinancial"
  | "rationaleRespite"
  | "rationaleParentSupport"
  | "rationaleSiblingSupport"
  | "rationaleTransportation"
  | "rationaleFuturePlanning"
  | "rationaleDiagnosisEducation"
  | "rationaleRecreation"
  | "resourcesTitle"
  | "resourcesIntro"
  | "resourcesFoundBelow"
  | "basicsCountyQuestion"
  | "basicsYearQuestion"
  | "basicsStageQuestion"
  | "basicsTurnNext"
  | "basicsPrefillTitle"
  | "basicsPrefillIntro"
  | "basicsPrefillConfirm"
  | "basicsPrefillChange"
  | "basicsPrefillApproxYear"
  | "rankHeardTitle"
  | "rankHeardFallback"
  | "rankQuotePrefix"
  | "rankUrgencyActNow"
  | "rankUrgencySoon"
  | "rankUrgencyWhenReady"
  | "resourceSourceLanguageNotice"
  | "nearbyTherapeuticRecreationTitle"
  | "nearbyTherapeuticRecreationIntro"
  | "resourceSource"
  | "resourceVerified"
  | "resourceAgeBand"
  | "resourceContact"
  | "resourceReferralMode"
  | "resourceHumanVerify"
  | "resourceActNow"
  | "resourceAllAges"
  | "resourceAgeFrom"
  | "resourceAgeThrough"
  | "resourceAgeBetween"
  | "referralSelfServe"
  | "referralCall"
  | "referralProvider"
  | "referralSchool"
  | "referralNavigator"
  | "resourceSave"
  | "resourceSaved"
  | "resourceShare"
  | "resourceShareConsent"
  | "resourceShareConsentRequired"
  | "resourceShareComplete"
  | "resourceOpenSource"
  | "resourceAlreadyEnrolled"
  | "resourceMarkEnrolled"
  | "resourceUnmarkEnrolled"
  | "savedResourcesTitle"
  | "savedResourcesEmpty"
  | "emptyFallbackTitle"
  | "emptyFallbackBody"
  | "emptyNavigatorHonesty"
  | "timelineTitle"
  | "timelineIntro"
  | "timelineNow"
  | "timelineNext"
  | "timelineLater"
  | "timelineNoProfile"
  | "timelineEmpty"
  | "timelineYearOnlyNotice"
  | "timelineDemoControlTitle"
  | "timelineDemoControlIntro"
  | "timelineDemoThisMonth"
  | "timelineDemoOneMonthAgo"
  | "timelineDemoThreeMonthsAgo"
  | "timelineDemoSixMonthsAgo"
  | "timelineFirstStepsTitle"
  | "timelineFirstStepsBody"
  | "timelineAgeThreeTransitionTitle"
  | "timelineAgeThreeTransitionBody"
  | "timelineSchoolEnrollmentTitle"
  | "timelineSchoolEnrollmentBody"
  | "timelineWaiverApplyTitle"
  | "timelineWaiverApplyBody"
  | "timelineSchoolArcTitle"
  | "timelineSchoolArcBody"
  | "timelineParentConnectionTitle"
  | "timelineParentConnectionBody"
  | "timelineSiblingRespiteTitle"
  | "timelineSiblingRespiteBody"
  | "timelineMissionTransitionTitle"
  | "timelineMissionTransitionBody"
  | "timelineBeforeEighteenTitle"
  | "timelineBeforeEighteenBody"
  | "timelinePerinatalOneMonthTitle"
  | "timelinePerinatalOneMonthCta"
  | "timelinePerinatalTwoMonthTitle"
  | "timelinePerinatalTwoMonthCta"
  | "timelinePerinatalFourMonthTitle"
  | "timelinePerinatalFourMonthCta"
  | "timelinePerinatalSixMonthTitle"
  | "timelinePerinatalSixMonthCta"
  | "timelineDevelopmentEighteenTitle"
  | "timelineDevelopmentEighteenBody"
  | "timelineDevelopmentEighteenCta"
  | "timelineDevelopmentThirtyTitle"
  | "timelineDevelopmentThirtyBody"
  | "timelineDevelopmentThirtyCta";

export const familyStrings: Record<Language, Record<FamilyStringKey, string>> = {
  en: {
    pageTitle: "Ladder — your child's development",
    demoBadge: "UKHCI Ladder · concept demo — not an official service",
    intro: "This tool focuses on your child's growth, learning, and development. We can point you to Kentucky programs that may help. We cannot say what your child has, and we cannot decide what you qualify for. Only the program can do that.",
    spanishReviewNotice: "The Spanish here is a rough draft. A native speaker still needs to check it.",
    setupTitle: "Add or change your child's details",
    setupIntro: "Name, birth month, school stage, and any diagnoses help fine-tune what we show. Please do not enter a last name, a full birthday, an address, or income.",
    profileCountyLabel: "Kentucky county",
    profileCountyPlaceholder: "Choose a county",
    profileChildNameLabel: "Child's first name (optional)",
    profileChildNamePlaceholder: "First name only",
    profileBirthYearLabel: "Birth year",
    profileBirthYearPlaceholder: "YYYY",
    profileBirthMonthLabel: "Birth month",
    profileBirthMonthOptional: "Optional. Month only — not the full birthday.",
    profileSchoolStageLabel: "School stage",
    profileDiagnosesLabel: "Diagnoses a doctor or specialist has already given (optional)",
    profileDiagnosisDateLabel: "Diagnosis month (optional)",
    profileOtherDiagnosisLabel: "Other diagnosis label",
    profileOtherDiagnosisPlaceholder: "Use the words you were given",
    profileSave: "Save these details",
    profileSaved: "Saved",
    profileEdit: "Change these details",
    profileBirthYearError: "Enter a four-digit birth year.",
    profileBirthMonthError: "Choose a birth month from 1 through 12.",
    profileOtherDiagnosisError: "Enter the words you were given for the other diagnosis.",
    diagnosisAutism: "Autism",
    diagnosisAdhd: "ADHD",
    diagnosisDyslexia: "Dyslexia",
    diagnosisSpeechLanguage: "Speech or language disorder",
    diagnosisDevelopmentalDelay: "Developmental delay",
    diagnosisIntellectualDisability: "Intellectual disability",
    diagnosisDownSyndrome: "Down syndrome",
    diagnosisOther: "Other",
    diagnosisAdd: "Add diagnosis",
    diagnosisRemove: "Remove diagnosis",
    schoolNotSchoolAge: "Not school age",
    schoolPreschool: "Preschool",
    schoolElementary: "Elementary school",
    schoolMiddle: "Middle school",
    schoolHigh: "High school",
    schoolPostHigh: "After high school",
    screenTitle: "What would help?",
    screenIntro: "All of these are optional. Saying yes helps us find the right places. It is not a diagnosis, and it does not decide what you qualify for.",
    screenEarlyIntervention: "Would help before age three, such as First Steps, be useful?",
    screenTherapies: "Are you looking for speech, occupational, physical, or other therapies?",
    screenSchoolIep: "Would help with school, an ARC meeting, an IEP, or a 504 plan be useful?",
    screenWaiversFinancial: "Would you like information about waivers, benefits, or financial supports?",
    screenRespite: "Would a planned break from caregiving be helpful?",
    screenParentSupport: "Would you like to meet another parent or a family support group?",
    screenSiblingSupport: "Would support for brothers or sisters be helpful?",
    screenTransportation: "Would help getting to services or activities be useful?",
    answerYes: "Yes",
    answerNo: "No",
    answerDeclined: "Prefer not to answer",
    screenSubmit: "See what can help",
    screenSaved: "Your answers were saved on this device.",
    domainEarlyIntervention: "Early intervention",
    domainTherapies: "Therapies",
    domainSchoolIep: "School and IEP",
    domainWaiversFinancial: "Waivers and financial support",
    domainRespite: "Respite",
    domainParentSupport: "Parent support",
    domainSiblingSupport: "Sibling support",
    domainTransportation: "Transportation",
    domainFuturePlanning: "Future planning",
    domainDiagnosisEducation: "Diagnosis education",
    domainRecreation: "Inclusive recreation",
    interviewTitle: "Tell us about your child and their needs",
    interviewIntro: "Tell us what you have noticed about how your child talks, learns, moves, or acts — and what you have already tried. We use your own words to find help. We do not diagnose.",
    interviewLabel: "What would you like help with?",
    interviewPlaceholder: "For example: My son is 3 and barely talking. The doctor said wait and see, but I'm worried.",
    interviewMicStart: "Start speaking",
    interviewMicStop: "Stop listening",
    interviewMicDone: "Done recording",
    interviewListening: "Listening — keep talking. Tap Done recording when you are finished.",
    interviewReconnecting: "Still listening — reconnecting the microphone…",
    interviewFinished: "Recording finished — review your description before finding help.",
    interviewStopped: "Recording stopped — your words were saved. Tap Start speaking to continue.",
    interviewSubmit: "Find help",
    interviewWorking: "Reading what you wrote…",
    interviewErrorTooShort: "Please write at least 10 characters.",
    interviewErrorTooLong: "Please keep this to 5000 characters or fewer. Nothing you wrote was cut off.",
    interviewErrorUnavailable: "Voice typing does not work in this browser. You can still type.",
    interviewErrorFallback: "The live helper was not available, so this demo read your words on your device instead.",
    interviewCount: "{count} of {max} characters",
    interviewSafetyRedirect: "Your safety comes first. We are opening help right now instead of showing programs.",
    interviewSafetyRedirectTitle: "Help right now",
    interviewSafetyRedirectBody: "We are opening help right now. We will not read your words or show programs for this message.",
    followUpSchoolIepQuestion: "What has the school offered so far?",
    followUpSchoolIepChip1: "Nothing yet",
    followUpSchoolIepChip2: "A meeting is planned",
    followUpSchoolIepChip3: "An evaluation was done",
    followUpTherapiesQuestion: "Has anyone talked with you about therapy visits?",
    followUpTherapiesChip1: "Not yet",
    followUpTherapiesChip2: "We are on a list",
    followUpTherapiesChip3: "We go now",
    followUpWaiversQuestion: "Have you applied for any state programs yet?",
    followUpWaiversChip1: "Not yet",
    followUpWaiversChip2: "Applied, still waiting",
    followUpWaiversChip3: "Not sure",
    followUpRespiteQuestion: "Who can take over for a few hours?",
    followUpRespiteChip1: "No one right now",
    followUpRespiteChip2: "Family sometimes",
    followUpRespiteChip3: "A paid helper",
    followUpGenericDayQuestion: "What part of a typical day is hardest?",
    followUpGenericDayChip1: "Mornings",
    followUpGenericDayChip2: "Afternoons",
    followUpGenericDayChip3: "Bedtime",
    followUpGenericHelpQuestion: "Who helps your family right now?",
    followUpGenericHelpChip1: "No one",
    followUpGenericHelpChip2: "Family or friends",
    followUpGenericHelpChip3: "A professional",
    orientationRoundCount: "Question {round} of {max}",
    followUpChipsLabel: "Suggested answers",
    followUpAnswerLabel: "Or type a short answer",
    followUpAnswerPlaceholder: "Type your answer",
    followUpAnswerSubmit: "Add answer",
    followUpAnswerError: "Enter an answer before continuing.",
    orientationComplete: "Thanks. That is enough to get you started.",
    orientationStartOver: "Start over",
    factsTitle: "Here is what we heard",
    factsIntro: "Check anything we got right. Nothing is saved until you say it is correct.",
    evidencePatientReported: "From your words",
    evidenceInferred: "Our guess — please check",
    evidenceConfirmed: "You said this is right",
    factSource: "You wrote",
    factConfirm: "Yes, that is right",
    factConfirmed: "Marked as correct",
    needsScreenDisclosureTitle: "Would you rather answer yes or no questions?",
    needsScreenDisclosureBody: "Eight quick questions instead of writing.",
    domainRationaleTitle: "Why we are showing this",
    factGradeLabel: "Grade",
    factReportedDiagnosisLabel: "Reported diagnosis",
    factConcernSchoolLabel: "About school and learning",
    factConcernSchoolValue: "School and learning may need support",
    factConcernSpeechLabel: "About talking",
    factConcernSpeechValue: "Talking and language may need support",
    factConcernBehaviorLabel: "About behavior and routines",
    factConcernBehaviorValue: "Behavior and daily routines may need support",
    factConcernMotorLabel: "About moving",
    factConcernMotorValue: "Moving and coordination may need support",
    rationaleEarlyIntervention: "You mentioned speech or talking, and your child is under three.",
    rationaleTherapies: "You mentioned speech, talking, or therapy.",
    rationaleSchoolIep: "You mentioned school, an IEP, or help with reading.",
    rationaleWaiversFinancial: "You asked about waivers or help paying for things.",
    rationaleRespite: "You said you need a break from caregiving.",
    rationaleParentSupport: "You said you feel overwhelmed or unsure where to start.",
    rationaleSiblingSupport: "You asked about help for a brother or sister.",
    rationaleTransportation: "You mentioned needing a ride or a way to get there.",
    rationaleFuturePlanning: "You asked about becoming an adult or planning ahead.",
    rationaleDiagnosisEducation: "You asked to learn more about a diagnosis you mentioned.",
    rationaleRecreation: "You asked about clubs, sports, horses, or things to do.",
    resourcesTitle: "Places that can help",
    resourcesIntro: "These are based on your county, your child's age, and what you told us. Always check the program's own page — their rules are the ones that count.",
    resourcesFoundBelow: "We found {count} places that can help — they're just below.",
    basicsCountyQuestion: "To find programs near you — which Kentucky county do you live in?",
    basicsYearQuestion: "What year was your child born? Just the year.",
    basicsStageQuestion: "Is your child in school yet?",
    basicsTurnNext: "Next",
    basicsPrefillTitle: "We already picked this up from what you wrote",
    basicsPrefillIntro: "So you do not have to type it twice. Nothing is saved until you say it is right.",
    basicsPrefillConfirm: "Yes, that is right",
    basicsPrefillChange: "Change something",
    basicsPrefillApproxYear: "about {year}",
    rankHeardTitle: "What matters most right now",
    rankHeardFallback:
      "These are based on what you told us, your county, and your child's age. Check each program's own page — their rules are the ones that count.",
    rankQuotePrefix: "You said",
    rankUrgencyActNow: "Worth doing now",
    rankUrgencySoon: "Soon",
    rankUrgencyWhenReady: "When you are ready",
    resourceSourceLanguageNotice: "Some details come straight from the organizations and may still be in English while we work on a checked translation.",
    nearbyTherapeuticRecreationTitle: "Something else nearby",
    nearbyTherapeuticRecreationIntro: "This one is in your county and fits your child's age. It offers both fun activities and therapy. We are showing it as an extra — it did not change what we found above.",
    resourceSource: "Source",
    resourceVerified: "Checked on {date}",
    resourceAgeBand: "Age range",
    resourceContact: "How to start",
    resourceReferralMode: "How to get in",
    resourceHumanVerify: "Call and check before you count on this. Details change.",
    resourceActNow: "Why it helps to start now",
    resourceAllAges: "All ages",
    resourceAgeFrom: "Age {min} and older",
    resourceAgeThrough: "Birth through age {max}",
    resourceAgeBetween: "Ages {min}–{max}",
    referralSelfServe: "Start online",
    referralCall: "Call directly",
    referralProvider: "Ask a provider for a referral",
    referralSchool: "Contact the school",
    referralNavigator: "Ask a navigator to help",
    resourceSave: "Save",
    resourceSaved: "Saved",
    resourceShare: "Share",
    resourceShareConsent: "I agree to share this resource now.",
    resourceShareConsentRequired: "Check the consent box before sharing.",
    resourceShareComplete: "Share recorded with your consent.",
    resourceOpenSource: "See their official page",
    resourceAlreadyEnrolled: "You already have this",
    resourceMarkEnrolled: "We already have this",
    resourceUnmarkEnrolled: "We do not have this",
    savedResourcesTitle: "Saved for later",
    savedResourcesEmpty: "Anything you save will show up here next time.",
    emptyFallbackTitle: "Nothing local matched yet",
    emptyFallbackBody: "Here are statewide places to start while you keep looking closer to home.",
    emptyNavigatorHonesty: "A real person can help you look locally. This demo cannot promise a program has room or that you will qualify.",
    timelineTitle: "What to do, and when",
    timelineIntro: "Based on the age and dates you gave us. This is a plan to think about — not a reminder service, and not a decision about what you qualify for.",
    timelineNow: "Now",
    timelineNext: "Next",
    timelineLater: "Later",
    timelineNoProfile: "Add your county and your child's birth year to see what comes next.",
    timelineEmpty: "Nothing to plan for right now based on what you have told us.",
    timelineYearOnlyNotice: "We only know the birth year, so we show timing early to be safe.",
    timelineDemoControlTitle: "Demo timeline control",
    timelineDemoControlIntro: "Move the saved diagnosis dates back to preview each stage. This changes the saved dates only. It does not change the clock on your device.",
    timelineDemoThisMonth: "Set diagnosis dates to this month",
    timelineDemoOneMonthAgo: "Set diagnosis dates to 1 month ago",
    timelineDemoThreeMonthsAgo: "Set diagnosis dates to 3 months ago",
    timelineDemoSixMonthsAgo: "Set diagnosis dates to 6 months ago",
    timelineFirstStepsTitle: "Contact First Steps now",
    timelineFirstStepsBody: "First Steps stops taking new referrals 45 days before a child turns three. Call your local First Steps office to see if there is still time, and ask what comes next if there is not.",
    timelineAgeThreeTransitionTitle: "Plan ahead before age three",
    timelineAgeThreeTransitionBody: "Ask First Steps for a transition meeting and stay signed up. That way, a child who qualifies can have an IEP ready by their third birthday.",
    timelineSchoolEnrollmentTitle: "Get ready for school",
    timelineSchoolEnrollmentBody: "Learn how Kentucky's ARC meetings and IEPs work before preschool or kindergarten starts.",
    timelineWaiverApplyTitle: "Ask how to apply for the Michelle P. Waiver",
    timelineWaiverApplyBody: "The Michelle P. waiting list goes in order by the date you apply, so it helps to ask now. The state decides who qualifies and where you land on the list.",
    timelineSchoolArcTitle: "Get ready for the school ARC meeting",
    timelineSchoolArcBody: "Write down what worries you, then ask the school how to request an ARC meeting or an IEP evaluation.",
    timelineParentConnectionTitle: "Talk to another parent",
    timelineParentConnectionBody: "A parent group or a parent mentor can walk you through what comes next, so you are not figuring this out alone.",
    timelineSiblingRespiteTitle: "Look into help for siblings and a break for you",
    timelineSiblingRespiteBody: "Look for local options for brothers and sisters, and for planned breaks from caregiving.",
    timelineMissionTransitionTitle: "Start planning for adult life",
    timelineMissionTransitionBody: "Use the school ARC meetings and Kentucky's transition programs to start planning for life after school.",
    timelineBeforeEighteenTitle: "Get ready for age eighteen",
    timelineBeforeEighteenBody: "Before your child turns 18, look into applying for SSI again, the choice between supported decision-making and guardianship, and STABLE savings accounts.",
    timelinePerinatalOneMonthTitle: "Check in with yourself at 1 month",
    timelinePerinatalOneMonthCta: "Start your 1-month check-in",
    timelinePerinatalTwoMonthTitle: "Check in with yourself at 2 months",
    timelinePerinatalTwoMonthCta: "Start your 2-month check-in",
    timelinePerinatalFourMonthTitle: "Check in with yourself at 4 months",
    timelinePerinatalFourMonthCta: "Start your 4-month check-in",
    timelinePerinatalSixMonthTitle: "Check in with yourself at 6 months",
    timelinePerinatalSixMonthCta: "Start your 6-month check-in",
    timelineDevelopmentEighteenTitle: "18-month development check",
    timelineDevelopmentEighteenBody: "You can do a short check on how your child is growing and learning, right here in the app.",
    timelineDevelopmentEighteenCta: "Open family check-ins",
    timelineDevelopmentThirtyTitle: "30-month development check",
    timelineDevelopmentThirtyBody: "You can do a short check on how your child is growing and learning, right here in the app.",
    timelineDevelopmentThirtyCta: "Open family check-ins"
  },
  es: {
    pageTitle: "Ladder — el desarrollo de tu hijo o hija",
    demoBadge: "UKHCI Ladder · demo conceptual — no es un servicio oficial",
    intro: "Esta herramienta se enfoca en el crecimiento, el aprendizaje y el desarrollo de tu hijo o hija. Podemos mostrarte programas de Kentucky que pueden ayudar. No podemos decir qué tiene tu hijo o hija, ni decidir para qué califican. Solo el programa puede hacer eso.",
    spanishReviewNotice: "El español aquí es un borrador. Todavía falta que lo revise una persona hablante nativa.",
    setupTitle: "Agrega o cambia los datos de tu hijo o hija",
    setupIntro: "El nombre, el mes de nacimiento, la etapa escolar y los diagnósticos ayudan a afinar lo que mostramos. Por favor no escribas apellido, fecha de nacimiento completa, dirección ni ingresos.",
    profileCountyLabel: "Condado de Kentucky",
    profileCountyPlaceholder: "Elige un condado",
    profileChildNameLabel: "Primer nombre del niño o niña (opcional)",
    profileChildNamePlaceholder: "Solo el primer nombre",
    profileBirthYearLabel: "Año de nacimiento",
    profileBirthYearPlaceholder: "AAAA",
    profileBirthMonthLabel: "Mes de nacimiento",
    profileBirthMonthOptional: "Opcional. Solo el mes, no la fecha completa.",
    profileSchoolStageLabel: "Etapa escolar",
    profileDiagnosesLabel: "Diagnósticos que ya dio un médico o especialista (opcional)",
    profileDiagnosisDateLabel: "Mes del diagnóstico (opcional)",
    profileOtherDiagnosisLabel: "Otro diagnóstico",
    profileOtherDiagnosisPlaceholder: "Usa las palabras que te dieron",
    profileSave: "Guardar estos datos",
    profileSaved: "Guardado",
    profileEdit: "Cambiar estos datos",
    profileBirthYearError: "Escribe un año de nacimiento de cuatro dígitos.",
    profileBirthMonthError: "Elige un mes de nacimiento del 1 al 12.",
    profileOtherDiagnosisError: "Escribe las palabras que te dieron para el otro diagnóstico.",
    diagnosisAutism: "Autismo",
    diagnosisAdhd: "TDAH",
    diagnosisDyslexia: "Dislexia",
    diagnosisSpeechLanguage: "Trastorno del habla o del lenguaje",
    diagnosisDevelopmentalDelay: "Retraso del desarrollo",
    diagnosisIntellectualDisability: "Discapacidad intelectual",
    diagnosisDownSyndrome: "Síndrome de Down",
    diagnosisOther: "Otro",
    diagnosisAdd: "Agregar diagnóstico",
    diagnosisRemove: "Quitar diagnóstico",
    schoolNotSchoolAge: "Aún no tiene edad escolar",
    schoolPreschool: "Preescolar",
    schoolElementary: "Escuela primaria",
    schoolMiddle: "Escuela intermedia",
    schoolHigh: "Escuela secundaria",
    schoolPostHigh: "Después de la secundaria",
    screenTitle: "¿Qué ayudaría?",
    screenIntro: "Todas estas preguntas son opcionales. Decir que sí nos ayuda a encontrar los lugares correctos. No es un diagnóstico y no decide para qué calificas.",
    screenEarlyIntervention: "¿Sería útil recibir ayuda antes de los tres años, como First Steps?",
    screenTherapies: "¿Buscas terapia del habla, ocupacional, física u otra terapia?",
    screenSchoolIep: "¿Sería útil recibir ayuda con la escuela, una reunión ARC, un IEP o un plan 504?",
    screenWaiversFinancial: "¿Quieres información sobre exenciones, beneficios o apoyos económicos?",
    screenRespite: "¿Sería útil un descanso planificado del cuidado?",
    screenParentSupport: "¿Te gustaría conocer a otro padre, madre o grupo de apoyo familiar?",
    screenSiblingSupport: "¿Sería útil recibir apoyo para hermanos o hermanas?",
    screenTransportation: "¿Sería útil recibir ayuda para llegar a servicios o actividades?",
    answerYes: "Sí",
    answerNo: "No",
    answerDeclined: "Prefiero no responder",
    screenSubmit: "Ver qué puede ayudar",
    screenSaved: "Tus respuestas se guardaron en este dispositivo.",
    domainEarlyIntervention: "Intervención temprana",
    domainTherapies: "Terapias",
    domainSchoolIep: "Escuela e IEP",
    domainWaiversFinancial: "Exenciones y apoyo económico",
    domainRespite: "Respiro para cuidadores",
    domainParentSupport: "Apoyo para padres y madres",
    domainSiblingSupport: "Apoyo para hermanos",
    domainTransportation: "Transporte",
    domainFuturePlanning: "Planificación para el futuro",
    domainDiagnosisEducation: "Educación sobre diagnósticos",
    domainRecreation: "Recreación inclusiva",
    interviewTitle: "Cuéntanos sobre tu hijo o hija y sus necesidades",
    interviewIntro: "Cuéntanos qué has notado sobre cómo habla, aprende, se mueve o se comporta tu hijo o hija, y qué ya intentaste. Usamos tus propias palabras para buscar ayuda. No diagnosticamos.",
    interviewLabel: "¿Con qué te gustaría recibir ayuda?",
    interviewPlaceholder: "Por ejemplo: Mi hijo tiene 3 años y casi no habla. El doctor dijo que esperáramos, pero estoy preocupada.",
    interviewMicStart: "Empezar a hablar",
    interviewMicStop: "Dejar de escuchar",
    interviewMicDone: "Terminar grabación",
    interviewListening: "Escuchando — sigue hablando. Toca Terminar grabación cuando hayas terminado.",
    interviewReconnecting: "Sigo escuchando — reconectando el micrófono…",
    interviewFinished: "Grabación terminada — revisa tu descripción antes de buscar ayuda.",
    interviewStopped: "La grabación se detuvo — tus palabras se guardaron. Toca Empezar a hablar para continuar.",
    interviewSubmit: "Buscar ayuda",
    interviewWorking: "Leyendo lo que escribiste…",
    interviewErrorTooShort: "Escribe al menos 10 caracteres.",
    interviewErrorTooLong: "Usa 5000 caracteres o menos. No se recortó nada de lo que escribiste.",
    interviewErrorUnavailable: "El dictado por voz no funciona en este navegador. Aún puedes escribir.",
    interviewErrorFallback: "El asistente en vivo no estaba disponible, así que este demo leyó tus palabras en tu dispositivo.",
    interviewCount: "{count} de {max} caracteres",
    interviewSafetyRedirect: "Tu seguridad es lo primero. Abriremos ayuda ahora mismo en vez de mostrar programas.",
    interviewSafetyRedirectTitle: "Ayuda ahora mismo",
    interviewSafetyRedirectBody: "Abriremos ayuda ahora mismo. No leeremos tus palabras ni mostraremos programas para este mensaje.",
    followUpSchoolIepQuestion: "¿Qué ha ofrecido la escuela hasta ahora?",
    followUpSchoolIepChip1: "Nada todavía",
    followUpSchoolIepChip2: "Hay una reunión planeada",
    followUpSchoolIepChip3: "Ya hicieron una evaluación",
    followUpTherapiesQuestion: "¿Alguien te ha hablado sobre visitas de terapia?",
    followUpTherapiesChip1: "Todavía no",
    followUpTherapiesChip2: "Estamos en una lista",
    followUpTherapiesChip3: "Vamos ahora",
    followUpWaiversQuestion: "¿Has solicitado algún programa estatal?",
    followUpWaiversChip1: "Todavía no",
    followUpWaiversChip2: "Solicité y sigo esperando",
    followUpWaiversChip3: "No estoy seguro",
    followUpRespiteQuestion: "¿Quién puede encargarse por unas horas?",
    followUpRespiteChip1: "Nadie por ahora",
    followUpRespiteChip2: "A veces la familia",
    followUpRespiteChip3: "Una persona de apoyo pagada",
    followUpGenericDayQuestion: "¿Qué parte de un día típico es la más difícil?",
    followUpGenericDayChip1: "Las mañanas",
    followUpGenericDayChip2: "Las tardes",
    followUpGenericDayChip3: "La hora de dormir",
    followUpGenericHelpQuestion: "¿Quién ayuda a tu familia ahora?",
    followUpGenericHelpChip1: "Nadie",
    followUpGenericHelpChip2: "Familiares o amigos",
    followUpGenericHelpChip3: "Un profesional",
    orientationRoundCount: "Pregunta {round} de {max}",
    followUpChipsLabel: "Respuestas sugeridas",
    followUpAnswerLabel: "O escribe una respuesta corta",
    followUpAnswerPlaceholder: "Escribe tu respuesta",
    followUpAnswerSubmit: "Agregar respuesta",
    followUpAnswerError: "Escribe una respuesta antes de continuar.",
    orientationComplete: "Gracias. Con eso basta para empezar.",
    orientationStartOver: "Empezar de nuevo",
    factsTitle: "Esto fue lo que entendimos",
    factsIntro: "Marca lo que entendimos bien. No se guarda nada hasta que digas que está correcto.",
    evidencePatientReported: "De tus palabras",
    evidenceInferred: "Es una suposición — revísala",
    evidenceConfirmed: "Dijiste que está correcto",
    factSource: "Escribiste",
    factConfirm: "Sí, así es",
    factConfirmed: "Marcado como correcto",
    needsScreenDisclosureTitle: "¿Prefieres responder preguntas de sí o no?",
    needsScreenDisclosureBody: "Ocho preguntas rápidas en vez de escribir.",
    domainRationaleTitle: "Por qué te mostramos esto",
    factGradeLabel: "Grado",
    factReportedDiagnosisLabel: "Diagnóstico informado",
    factConcernSchoolLabel: "Sobre la escuela y el aprendizaje",
    factConcernSchoolValue: "La escuela y el aprendizaje podrían necesitar apoyo",
    factConcernSpeechLabel: "Sobre el habla",
    factConcernSpeechValue: "El habla y el lenguaje podrían necesitar apoyo",
    factConcernBehaviorLabel: "Sobre el comportamiento y las rutinas",
    factConcernBehaviorValue: "El comportamiento y las rutinas diarias podrían necesitar apoyo",
    factConcernMotorLabel: "Sobre el movimiento",
    factConcernMotorValue: "El movimiento y la coordinación podrían necesitar apoyo",
    rationaleEarlyIntervention: "Mencionaste el habla y tu hijo o hija tiene menos de tres años.",
    rationaleTherapies: "Mencionaste el habla, el lenguaje o la terapia.",
    rationaleSchoolIep: "Mencionaste la escuela, un IEP o ayuda con la lectura.",
    rationaleWaiversFinancial: "Preguntaste por exenciones o ayuda para pagar.",
    rationaleRespite: "Dijiste que necesitas un descanso del cuidado.",
    rationaleParentSupport: "Dijiste que te sientes abrumada o que no sabes por dónde empezar.",
    rationaleSiblingSupport: "Preguntaste por ayuda para un hermano o hermana.",
    rationaleTransportation: "Mencionaste que necesitas transporte o cómo llegar.",
    rationaleFuturePlanning: "Preguntaste por la vida adulta o por planificar el futuro.",
    rationaleDiagnosisEducation: "Pediste saber más sobre un diagnóstico que mencionaste.",
    rationaleRecreation: "Preguntaste por clubes, deportes, caballos o actividades.",
    resourcesTitle: "Lugares que pueden ayudar",
    resourcesIntro: "Esto se basa en tu condado, la edad de tu hijo o hija y lo que nos contaste. Revisa siempre la página del programa — sus reglas son las que valen.",
    resourcesFoundBelow: "Encontramos {count} lugares que pueden ayudar — están aquí abajo.",
    basicsCountyQuestion: "Para buscar programas cerca de ti — ¿en qué condado de Kentucky vives?",
    basicsYearQuestion: "¿En qué año nació tu hijo o hija? Solo el año.",
    basicsStageQuestion: "¿Tu hijo o hija ya va a la escuela?",
    basicsTurnNext: "Siguiente",
    basicsPrefillTitle: "Esto ya lo tomamos de lo que escribiste",
    basicsPrefillIntro: "Así no lo tienes que escribir dos veces. No se guarda nada hasta que digas que está bien.",
    basicsPrefillConfirm: "Sí, así es",
    basicsPrefillChange: "Cambiar algo",
    basicsPrefillApproxYear: "alrededor de {year}",
    rankHeardTitle: "Lo más importante ahora",
    rankHeardFallback:
      "Esto se basa en lo que nos contaste, tu condado y la edad de tu hijo o hija. Revisa la página de cada programa — sus reglas son las que valen.",
    rankQuotePrefix: "Dijiste",
    rankUrgencyActNow: "Vale la pena hacerlo ahora",
    rankUrgencySoon: "Pronto",
    rankUrgencyWhenReady: "Cuando estés listo",
    resourceSourceLanguageNotice: "Algunos detalles vienen directo de las organizaciones y pueden seguir en inglés mientras preparamos una traducción revisada.",
    nearbyTherapeuticRecreationTitle: "Algo más cerca de ti",
    nearbyTherapeuticRecreationIntro: "Esta opción está en tu condado y va con la edad de tu hijo o hija. Ofrece actividades divertidas y también terapia. Te la mostramos como algo extra — no cambió lo que encontramos arriba.",
    resourceSource: "Fuente",
    resourceVerified: "Revisado el {date}",
    resourceAgeBand: "Rango de edad",
    resourceContact: "Cómo empezar",
    resourceReferralMode: "Cómo entrar",
    resourceHumanVerify: "Llama y confirma antes de contar con esto. Los datos cambian.",
    resourceActNow: "Por qué conviene empezar ahora",
    resourceAllAges: "Todas las edades",
    resourceAgeFrom: "Desde los {min} años",
    resourceAgeThrough: "Desde el nacimiento hasta los {max} años",
    resourceAgeBetween: "Edades de {min} a {max} años",
    referralSelfServe: "Empezar en línea",
    referralCall: "Llamar directamente",
    referralProvider: "Pedir un referido a un profesional",
    referralSchool: "Contactar a la escuela",
    referralNavigator: "Pedir ayuda a un navegador",
    resourceSave: "Guardar",
    resourceSaved: "Guardado",
    resourceShare: "Compartir",
    resourceShareConsent: "Acepto compartir este recurso ahora.",
    resourceShareConsentRequired: "Marca la casilla de consentimiento antes de compartir.",
    resourceShareComplete: "Se registró el intercambio con tu consentimiento.",
    resourceOpenSource: "Ver su página oficial",
    resourceAlreadyEnrolled: "Ya tienes esto",
    resourceMarkEnrolled: "Ya tenemos esto",
    resourceUnmarkEnrolled: "No tenemos esto",
    savedResourcesTitle: "Guardado para después",
    savedResourcesEmpty: "Lo que guardes aparecerá aquí la próxima vez.",
    emptyFallbackTitle: "Todavía no encontramos nada cerca de ti",
    emptyFallbackBody: "Aquí hay lugares estatales para empezar mientras sigues buscando más cerca de casa.",
    emptyNavigatorHonesty: "Una persona real puede ayudarte a buscar cerca de ti. Este demo no puede prometer que un programa tenga cupo ni que vayas a calificar.",
    timelineTitle: "Qué hacer, y cuándo",
    timelineIntro: "Esto se basa en la edad y las fechas que nos diste. Es un plan para pensar — no es un servicio de recordatorios ni una decisión sobre para qué calificas.",
    timelineNow: "Ahora",
    timelineNext: "Próximo",
    timelineLater: "Más adelante",
    timelineNoProfile: "Agrega tu condado y el año de nacimiento de tu hijo o hija para ver qué sigue.",
    timelineEmpty: "Por ahora no hay nada que planificar según lo que nos contaste.",
    timelineYearOnlyNotice: "Solo sabemos el año de nacimiento, así que mostramos las fechas temprano por precaución.",
    timelineDemoControlTitle: "Control de cronología para el demo",
    timelineDemoControlIntro: "Mueve hacia atrás las fechas de diagnóstico guardadas para ver cada etapa. Esto solo cambia las fechas guardadas. No cambia el reloj de tu dispositivo.",
    timelineDemoThisMonth: "Establecer las fechas de diagnóstico en este mes",
    timelineDemoOneMonthAgo: "Establecer las fechas de diagnóstico hace 1 mes",
    timelineDemoThreeMonthsAgo: "Establecer las fechas de diagnóstico hace 3 meses",
    timelineDemoSixMonthsAgo: "Establecer las fechas de diagnóstico hace 6 meses",
    timelineFirstStepsTitle: "Contacta a First Steps ahora",
    timelineFirstStepsBody: "First Steps deja de aceptar referidos nuevos 45 días antes de que el niño o niña cumpla tres años. Llama a tu oficina local de First Steps para ver si todavía hay tiempo, y pregunta qué sigue si ya no lo hay.",
    timelineAgeThreeTransitionTitle: "Planifica antes de los tres años",
    timelineAgeThreeTransitionBody: "Pídele a First Steps una reunión de transición y sigue inscrito. Así, un niño o niña que califique puede tener un IEP listo al cumplir tres años.",
    timelineSchoolEnrollmentTitle: "Prepárate para la escuela",
    timelineSchoolEnrollmentBody: "Conoce cómo funcionan las reuniones ARC y los IEP de Kentucky antes de que empiece el preescolar o el kindergarten.",
    timelineWaiverApplyTitle: "Pregunta cómo solicitar la exención Michelle P.",
    timelineWaiverApplyBody: "La lista de espera de Michelle P. va en orden según la fecha en que solicitas, así que conviene preguntar ahora. El estado decide quién califica y qué lugar te toca en la lista.",
    timelineSchoolArcTitle: "Prepárate para la reunión ARC de la escuela",
    timelineSchoolArcBody: "Anota lo que te preocupa y luego pregunta en la escuela cómo pedir una reunión ARC o una evaluación para un IEP.",
    timelineParentConnectionTitle: "Habla con otra familia",
    timelineParentConnectionBody: "Un grupo de padres o una persona mentora puede explicarte qué sigue, para que no tengas que resolverlo sola.",
    timelineSiblingRespiteTitle: "Busca ayuda para los hermanos y un descanso para ti",
    timelineSiblingRespiteBody: "Busca opciones cerca de ti para hermanos y hermanas, y descansos planificados del cuidado.",
    timelineMissionTransitionTitle: "Empieza a planificar la vida adulta",
    timelineMissionTransitionBody: "Usa las reuniones ARC de la escuela y los programas de transición de Kentucky para empezar a planificar la vida después de la escuela.",
    timelineBeforeEighteenTitle: "Prepárate para los dieciocho años",
    timelineBeforeEighteenBody: "Antes de que tu hijo o hija cumpla 18, infórmate sobre volver a solicitar SSI, la opción entre la toma de decisiones con apoyo y la tutela, y las cuentas de ahorro STABLE.",
    timelinePerinatalOneMonthTitle: "Revísate al primer mes",
    timelinePerinatalOneMonthCta: "Comienza tu chequeo del primer mes",
    timelinePerinatalTwoMonthTitle: "Revísate a los 2 meses",
    timelinePerinatalTwoMonthCta: "Comienza tu chequeo de los 2 meses",
    timelinePerinatalFourMonthTitle: "Revísate a los 4 meses",
    timelinePerinatalFourMonthCta: "Comienza tu chequeo de los 4 meses",
    timelinePerinatalSixMonthTitle: "Revísate a los 6 meses",
    timelinePerinatalSixMonthCta: "Comienza tu chequeo de los 6 meses",
    timelineDevelopmentEighteenTitle: "Chequeo del desarrollo de 18 meses",
    timelineDevelopmentEighteenBody: "Puedes hacer un chequeo corto sobre cómo crece y aprende tu hijo o hija, aquí mismo en la aplicación.",
    timelineDevelopmentEighteenCta: "Abrir chequeos familiares",
    timelineDevelopmentThirtyTitle: "Chequeo del desarrollo de 30 meses",
    timelineDevelopmentThirtyBody: "Puedes hacer un chequeo corto sobre cómo crece y aprende tu hijo o hija, aquí mismo en la aplicación.",
    timelineDevelopmentThirtyCta: "Abrir chequeos familiares"
  }
};

export function tFamily(
  language: Language,
  key: FamilyStringKey,
  vars?: Record<string, string | number>
): string {
  const template = familyStrings[language]?.[key] ?? familyStrings.en[key];
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}
