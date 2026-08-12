import type { Language } from "./strings";

export type FamilyStringKey =
  | "pageTitle"
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
  | "interviewDictationDisclosure"
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
  | "evidencePatientReported"
  | "evidenceInferred"
  | "evidenceConfirmed"
  | "factSource"
  | "evidenceTraceConversation"
  | "evidenceTraceScreen"
  | "evidenceTraceOrphaned"
  | "evidenceCaptureTyped"
  | "evidenceCaptureVoice"
  | "evidenceCaptureMixed"
  | "evidenceExtractionOnline"
  | "evidenceExtractionOnDevice"
  | "factConfirm"
  | "factConfirmed"
  | "factNotRight"
  | "factRowYes"
  | "factRowNo"
  | "factRowDetails"
  | "needsScreenDisclosureTitle"
  | "needsScreenDisclosureBody"
  | "domainRationaleTitle"
  | "factGradeLabel"
  | "factReportedDiagnosisLabel"
  | "factFunctionalBurdenLabel"
  | "factFunctionalBurdenValue"
  | "factPendingEvaluationLabel"
  | "factPendingEvaluationValue"
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
  | "apptSectionTitle"
  | "apptSectionIntro"
  | "apptJoinDemoBody"
  | "apptJoinDemoCta"
  | "apptOnListLine"
  | "apptOfferQuestion"
  | "apptBookedLine"
  | "apptPrepTitle"
  | "apptPrepBullet1"
  | "apptPrepBullet2"
  | "apptPrepBullet3"
  | "apptPrepSource"
  | "apptBarriersQuestion"
  | "apptBarrierRide"
  | "apptBarrierSiblings"
  | "apptBarrierWork"
  | "apptBarrierNone"
  | "apptBarriersThanks"
  | "apptBarriersNoneThanks"
  | "apptReminderT14"
  | "apptReminderT3"
  | "apptReminderT1"
  | "apptReminderConfirm"
  | "apptReminderReschedule"
  | "apptConfirmedLine"
  | "apptOverdueQuestion"
  | "apptOverdueWent"
  | "apptOverdueMissed"
  | "apptCompletedLine"
  | "apptMissedLine"
  | "apptRebookCta"
  | "apptDemoControlsTitle"
  | "apptDemoTwoWeeks"
  | "apptDemoFewDays"
  | "apptDemoTomorrow"
  | "apptDemoPassed"
  | "apptSafetyHold"
  | "resourcesTitle"
  | "preferencesTitle"
  | "preferencesSummary"
  | "preferencesIntro"
  | "preferencesHonesty"
  | "preferencesScopeLegend"
  | "preferencesScopeNone"
  | "preferencesScopeLocal"
  | "preferencesScopeStatewide"
  | "preferencesContactLegend"
  | "preferencesContactNone"
  | "preferencesContactSelfServe"
  | "preferencesContactCall"
  | "preferencesContactSchoolProvider"
  | "preferencesSave"
  | "preferencesSaved"
  | "resourcesIntro"
  | "basicsCountyQuestion"
  | "basicsYearQuestion"
  | "basicsStageQuestion"
  | "basicsTurnNext"
  | "basicsOptionalNote"
  | "basicsNotNow"
  | "rankHeardFallback"
  | "rankQuotePrefix"
  | "rankUrgencyActNow"
  | "rankUrgencySoon"
  | "rankUrgencyWhenReady"
  | "resourceSourceLanguageNotice"
  | "resourceCountyServiceArea"
  | "resourceStatewideServiceArea"
  | "resourceMatchReason"
  | "nearbyTherapeuticRecreationTitle"
  | "nearbyTherapeuticRecreationIntro"
  | "resourceSource"
  | "resourceVerified"
  | "resourceAgeBand"
  | "resourceContact"
  | "resourceReferralMode"
  | "resourceHumanVerify"
  | "resourceFreshnessExpired"
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
  | "resourceOpenSource"
  | "resourceAlreadyEnrolled"
  | "resourceMarkEnrolled"
  | "resourceUnmarkEnrolled"
  | "resourceMore"
  | "resourceLess"
  | "resourceAbout"
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
  | "timelineDevelopmentThirtyCta"
  | "waitHeaderTitle"
  | "waitHeaderOnList"
  | "waitHeaderOnListFresh"
  | "waitHeaderNoPrediction"
  | "rungSafety"
  | "rungVisit"
  | "rungClinicNow"
  | "rungClock"
  | "rungClockRange"
  | "rungCheckin"
  | "rungStep"
  | "rungJournal"
  | "waitChipNotes"
  | "waitChipNotesOne"
  | "waitChipSteps"
  | "waitChipStepsOne"
  | "waitChipVisit"
  | "waitChipSooner"
  | "journalTitle"
  | "journalIntro"
  | "journalNotePlaceholder"
  | "journalIncludeLabel"
  | "journalExcludedBadge"
  | "journalDeviceLine"
  | "journalExportNudge"
  | "journalMonthNote"
  | "journalMonthNoteOne"
  | "journalEarlierGroup"
  | "packetHeading"
  | "packetBornLine"
  | "packetNoticedHeading"
  | "packetFlagsHeading"
  | "packetFlagRegression"
  | "packetServicesHeading"
  | "packetStatusEnrolled"
  | "packetStatusInTouch"
  | "packetQuestionsHeading"
  | "packetRideLine"
  | "packetFooter"
  | "packetQResultsSchool"
  | "packetQCoordinatesNext"
  | "packetQTherapyStart"
  | "packetQWaiverEffect"
  | "packetQSchoolShare"
  | "packetQSecondVisit"
  | "packetQHomeHelp"
  | "packetQRegressionMeaning"
  | "packetQSiblingsRisk"
  | "packetQWhoToCall"
  | "packetPrepTitle"
  | "packetBringPacket"
  | "packetPickTitle"
  | "packetPrint"
  | "packetCopy"
  | "packetCopied"
  | "packetCopyFailed"
  | "packetSave"
  | "packetSaved"
  | "packetSaveFailed"
  | "packetFileName"
  | "packetShare"
  | "packetShareConsent"
  | "packetShareReceipt"
  | "packetShareCopiedReceipt"
  | "packetShareUnavailable"
  | "stepPlanCta"
  | "stepStatusPlanned"
  | "stepStatusTried"
  | "stepStatusInTouch"
  | "stepStatusEnrolled"
  | "stepStatusNotForUs"
  | "followupQuestion"
  | "followupGotThrough"
  | "followupLeftMessage"
  | "followupNotYet"
  | "followupNotForUs"
  | "followupThanks"
  | "clockFirstStepsRangeOpen"
  | "factRegressionLabel"
  | "factRegressionValue"
  | "extractionOnDevice"
  | "aiConsentTitle"
  | "aiConsentBody"
  | "aiConsentAccept"
  | "aiConsentGranting"
  | "aiConsentGrantError"
  | "aiConsentUnavailableNotice"
  | "aiConsentDecline"
  | "aiConsentDeclinedNotice"
  | "aiConsentActiveTitle"
  | "aiConsentActiveBody"
  | "aiConsentRevoke"
  | "aiUseNoneTitle"
  | "aiUseNoneBody"
  | "aiUseOnDeviceTitle"
  | "aiUseOnDeviceBody"
  | "aiUseOnlineTitle"
  | "aiUseOnlineBody"
  | "aiHistoryNoneTitle"
  | "aiHistoryNoneBody"
  | "aiHistoryOnDeviceTitle"
  | "aiHistoryOnDeviceBody"
  | "aiHistoryOnlineTitle"
  | "aiHistoryOnlineBody"
  | "safetyHeading"
  | "safetyMedicationHeading"
  | "safetyCrisis"
  | "safetyAbuse"
  | "safetyHarmToOthers"
  | "safetySocial"
  | "safetyMedicationAccess"
  | "safetyMedicationChange"
  | "safetyMissingChild"
  | "safetyEmergency"
  | "safetySteps"
  | "safetyNoInterpretation"
  | "safetyText988"
  | "safetyCallKySafe"
  | "safetyCall211"
  | "safetyCallNcmec"
  | "safetyDirectory"
  | "safetyAcknowledge"
  | "safetyReopen"
  | "safetyReopenHint"
  | "prototypeBannerTitle"
  | "prototypeBannerBody"
  | "serviceStatusLine"
  | "serviceStatusShort"
  | "programsCapped"
  | "notesEmptyTitle"
  | "notesEmptyBody"
  | "clockHandoff"
  | "clockHandoffLink"
  | "icsCheckinFileName"
  | "icsCheckinSummary"
  | "icsCheckinDescription"
  | "icsVisitFileName"
  | "icsVisitSummary"
  | "icsVisitDescription"
  | "icsVisitAlarm"
  | "remindTitle"
  | "remindNextLine"
  | "remindCalendar"
  | "remindCalendarWhy"
  | "remindCalendarSaved"
  | "remindCalendarFailed"
  | "remindInApp"
  | "remindInAppOn"
  | "remindInAppLimit"
  | "remindInAppBlocked"
  | "remindInAppUnsupported"
  | "remindNotificationTitle"
  | "remindNotificationBody"
  | "factMarkWrong"
  | "factMarkWrongHint"
  | "factMarkedWrong"
  | "clinicNowTitle"
  | "clinicNowBody"
  | "clinicNowBodyFirstSteps"
  | "clinicNowBodyGeneric"
  | "clinicNowAck"
  | "checkinTitle"
  | "checkinNoteInvite"
  | "checkinChildFallback"
  | "checkinAddNote"
  | "checkinNothingNew"
  | "checkinProbe"
  | "checkinProbeNo"
  | "checkinProbeUnsure"
  | "checkinProbeYes"
  | "probeExamples"
  | "probeExamplesSource"
  | "pulseQuestion"
  | "pulseSkip"
  | "checkinSkip"
  | "checkinDone"
  | "checkinDemoControl"
  | "guidesTitle"
  | "guidesIntro"
  | "soonerQuestion"
  | "soonerYes"
  | "soonerNo"
  | "soonerMornings"
  | "soonerAfternoons"
  | "soonerAnyWeekday"
  | "soonerNotice"
  | "soonerConfirm"
  | "soonerOnList"
  | "soonerLeave"
  | "soonerDemoCta"
  | "soonerDecline"
  | "navOnThisPage"
  | "navTell"
  | "navVisit"
  | "navResources"
  | "navJournal"
  | "navPacket"
  | "backToTop"
  | "resourceDetailsToggle"
  | "heardStripPrefix"
  | "heardStripCounty"
  | "heardStripChild"
  | "heardStripChildOne"
  | "heardStripChildUnderOne"
  | "heardStripChildFallback"
  | "stripDisclosureSummary"
  | "stripGuessesChip"
  | "stripTrustLine"
  | "stripExtractedNote"
  | "threadResourcesTitle"
  | "seeAllResources"
  | "seeAllResourcesOne"
  | "fallbackInThread"
  | "followUpOptional"
  | "packetBasicsExtracted"
  | "foldResourcesSummary"
  | "foldResourcesSummaryOne"
  | "foldJournalSummary"
  | "foldJournalSummaryOne"
  | "foldPacketSummary"
  | "foldTimelineSummary"
  | "foldTimelineSummaryOne"
  | "foldTimelineSummaryNone"
  | "tabHome"
  | "tabPrograms"
  | "tabNotes"
  | "tabVisit"
  | "tabsLabel"
  | "shellExit"
  | "shellHeaderSubtitle"
  | "homeReturnTitle"
  | "homeLastNote"
  | "agoToday"
  | "agoDays"
  | "agoDaysOne"
  | "agoMonths"
  | "agoMonthsOne"
  | "homeChipOnListSince"
  | "homeQueuedNext"
  | "homeComposerCta"
  | "homeComposerCtaNamed"
  | "homeDoorProgramsMeta"
  | "homeDoorProgramsMetaOne"
  | "homeDoorVisitMeta"
  | "homeDoorNotesMeta"
  | "homeDoorNotesMetaOne"
  | "homeDoorNotesMetaNone"
  | "homeTrustLine"
  | "notesEmptyCta"
  | "visitTabNoticeTitle"
  | "visitTabNoticeBody"
  | "visitTabNoticeOpen"
  | "visitTabNoticeDismiss"
  | "clockFirstStepsDated"
  | "clockFirstStepsRange"
  | "clockHeadline"
  | "clockAddBirthMonth"
  | "clockAddBirthMonthHint"
  | "clockBirthMonthSaved"
  | "resourceCallNumber"
  | "resourceCallAlso"
  | "resourceStartOnline"
  | "resourceAskProvider"
  | "resourceContactSchool"
  | "resourceAskNavigator"
  | "resourceShareCopy"
  | "resourceShareUnavailable"
  | "resourceShareReceipt"
  | "resourceShareCopiedReceipt"
  | "glossPoe"
  | "glossIfsp"
  | "glossIep"
  | "gloss504"
  | "glossArc"
  | "apptNoneWork"
  | "apptKeepYourPlace"
  | "apptNeedsBookedVisit"
  | "askEyebrow";

// Counted strings come in pairs: every "{count} things" key has a "…One" twin
// for a count of exactly one, and the call site picks. There is no plural
// machinery here on purpose — each language writes its own singular out loud.
export const familyStrings: Record<Language, Record<FamilyStringKey, string>> = {
  en: {
    pageTitle: "Ladder — your child's development",
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
    screenIntro: "Answer any that feel useful, and skip the rest — you can come back to them later. Saying yes helps us find the right places. It is not a diagnosis, and it does not decide what you qualify for.",
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
    domainDiagnosisEducation: "Understanding evaluation options",
    domainRecreation: "Inclusive recreation",
    interviewTitle: "Tell us about your child and their needs",
    interviewIntro: "Tell us what you have noticed about how your child talks, learns, moves, or acts — and what you have already tried. We use your own words to find help. Ladder cannot diagnose, decide whether your child qualifies for a program, tell you the result of a screening, monitor your child, or send a referral for you.",
    interviewLabel: "What would you like help with?",
    interviewPlaceholder: "For example: My son is 3 and barely talking. The doctor said wait and see, but I'm worried.",
    interviewDictationDisclosure:
      "Dictation uses your browser's speech-recognition service, which may process microphone audio off this device. Type instead to keep audio out of that service.",
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
    evidencePatientReported: "From your words",
    evidenceInferred: "Our guess — please check",
    evidenceConfirmed: "You said this is right",
    factSource: "You wrote",
    evidenceTraceConversation: "Evidence trail: {date} · {source} · {method}",
    evidenceTraceScreen: "Evidence trail: guided answers · processed on this device",
    evidenceTraceOrphaned: "Evidence trail: the original note is no longer linked",
    evidenceCaptureTyped: "typed",
    evidenceCaptureVoice: "spoken",
    evidenceCaptureMixed: "typed and spoken",
    evidenceExtractionOnline: "online helper",
    evidenceExtractionOnDevice: "processed on this device",
    factConfirm: "Yes, that is right",
    factConfirmed: "Marked as correct",
    factNotRight: "No, that is not right — leave it out of the visit packet",
    factRowYes: "Yes",
    factRowNo: "No",
    factRowDetails: "Why we wrote this",
    needsScreenDisclosureTitle: "Would you rather answer yes or no questions?",
    needsScreenDisclosureBody: "Eight quick questions instead of writing.",
    domainRationaleTitle: "Why we are showing this",
    factGradeLabel: "Grade",
    factReportedDiagnosisLabel: "Reported diagnosis",
    factFunctionalBurdenLabel: "Impact on daily life",
    factFunctionalBurdenValue: "Schoolwork is taking substantial time",
    factPendingEvaluationLabel: "Evaluation status",
    factPendingEvaluationValue: "Waiting for an evaluation",
    factConcernSchoolLabel: "About school and learning",
    factConcernSchoolValue: "You wrote about school and learning",
    factConcernSpeechLabel: "About talking",
    factConcernSpeechValue: "You wrote about talking and language",
    factConcernBehaviorLabel: "About behavior and routines",
    factConcernBehaviorValue: "You wrote about behavior and daily routines",
    factConcernMotorLabel: "About moving",
    factConcernMotorValue: "You wrote about moving and coordination",
    rationaleEarlyIntervention: "You mentioned speech or talking, and your child is under three.",
    rationaleTherapies: "You mentioned speech, talking, or therapy.",
    rationaleSchoolIep: "You mentioned school, an IEP, or help with reading.",
    rationaleWaiversFinancial: "You asked about waivers or help paying for things.",
    rationaleRespite: "You said you need a break from caregiving.",
    rationaleParentSupport: "You said you feel overwhelmed or unsure where to start.",
    rationaleSiblingSupport: "You asked about help for a brother or sister.",
    rationaleTransportation: "You mentioned needing a ride or a way to get there.",
    rationaleFuturePlanning: "You asked about becoming an adult or planning ahead.",
    rationaleDiagnosisEducation:
      "You asked for checked information about evaluation options without applying a label.",
    rationaleRecreation: "You asked about clubs, sports, horses, or things to do.",
    apptSectionTitle: "Your evaluation visit",
    apptSectionIntro: "Ladder walks with you from the waitlist to the visit — booking, getting ready, and solving anything that could get in the way.",
    apptJoinDemoBody: "This demo pretends your child is on the UK Developmental Pediatrics waitlist. Nothing here is a real appointment.",
    apptJoinDemoCta: "Show me (demo)",
    apptOnListLine: "In this demo, you're on the list at {clinic}.",
    apptOfferQuestion: "In this demo, an evaluation opening is available. Does one of these work?",
    apptBookedLine: "Booked for {when} (demo).",
    apptPrepTitle: "How to get ready",
    apptPrepBullet1: "Bring any school papers, past evaluations, and a list of what you have noticed.",
    apptPrepBullet2: "The visit can take a few hours. Your child can bring something that helps them feel calm.",
    apptPrepBullet3: "You know your child best. Your answers are a big part of the evaluation.",
    apptPrepSource: "Learn more: CDC, \"Learn the Signs. Act Early.\"",
    apptBarriersQuestion: "Is there anything that could make it hard to get to this visit?",
    apptBarrierRide: "We need a ride",
    apptBarrierSiblings: "Someone to watch the other kids",
    apptBarrierWork: "Hard to get time off work",
    apptBarrierNone: "We're all set",
    apptBarriersThanks: "Thanks — in this demo, the resources below can help and the simulated visit stays booked.",
    apptBarriersNoneThanks: "Great — in this demo, we'll show reminders as the visit gets close.",
    apptReminderT14: "Demo reminder: your visit at {clinic} is in about two weeks — {when}. Still good?",
    apptReminderT3: "Demo reminder: your visit is in a few days — {when}. Still good?",
    apptReminderT1: "Demo reminder: your visit is tomorrow — {when}. Still good?",
    apptReminderConfirm: "Yes, we'll be there",
    apptReminderReschedule: "We need a different time",
    apptConfirmedLine: "Confirmed for {when} (demo).",
    apptOverdueQuestion: "Your visit date has passed. Were you able to make it?",
    apptOverdueWent: "We made it",
    apptOverdueMissed: "We couldn't make it",
    apptCompletedLine: "Glad you made it (demo). In this demo, the clinic follows up with next steps while Ladder keeps helping.",
    apptMissedLine: "Life happens — in this demo, you have not lost your place. Let's find a new time.",
    apptRebookCta: "Find a new time",
    apptDemoControlsTitle: "Demo: move the visit closer",
    apptDemoTwoWeeks: "About 2 weeks away",
    apptDemoFewDays: "A few days away",
    apptDemoTomorrow: "Tomorrow",
    apptDemoPassed: "Date passed",
    apptSafetyHold: "Paused while the safety message above is open.",
    resourcesTitle: "Places that can help",
    preferencesTitle: "What matters for your program list (optional)",
    preferencesSummary: "Two choices Ladder can actually use to reorder the list.",
    preferencesIntro: "Choose only if it is useful. These choices change order, not which programs appear.",
    preferencesHonesty: "Ladder cannot verify openings, cost, insurance, language access, hours, or eligibility. Check with the source before relying on a listing.",
    preferencesScopeLegend: "Which reach should come first?",
    preferencesScopeNone: "No preference",
    preferencesScopeLocal: "Nearby or county-specific first",
    preferencesScopeStatewide: "Statewide options first",
    preferencesContactLegend: "What kind of first step feels most useful?",
    preferencesContactNone: "No preference",
    preferencesContactSelfServe: "Something I can start online myself",
    preferencesContactCall: "A person or navigator I can call",
    preferencesContactSchoolProvider: "A step through the school or a provider",
    preferencesSave: "Save list preferences",
    preferencesSaved: "List preferences saved on this device.",
    resourcesIntro: "These are based on your county, your child's age, and what you told us. Always check the program's own page — their rules are the ones that count.",
    basicsCountyQuestion: "To find programs near you — which Kentucky county do you live in?",
    basicsYearQuestion: "What year was your child born? Just the year.",
    basicsStageQuestion: "Is your child in school yet?",
    basicsTurnNext: "Next",
    basicsOptionalNote:
      "These details are optional. Without them, Ladder will not claim that a program is local or age-matched.",
    basicsNotNow: "Not now — I can add these later",
    rankHeardFallback:
      "These are based on what you told us, your county, and your child's age. Check each program's own page — their rules are the ones that count.",
    rankQuotePrefix: "You said",
    rankUrgencyActNow: "Time-sensitive: age rule",
    rankUrgencySoon: "Soon",
    rankUrgencyWhenReady: "When you are ready",
    resourceSourceLanguageNotice: "Some details come straight from the organizations and may still be in English while we work on a checked translation.",
    resourceCountyServiceArea: "Serves {county} County",
    resourceStatewideServiceArea: "Available statewide",
    resourceMatchReason: "Shown for {need}.",
    nearbyTherapeuticRecreationTitle: "Something else nearby",
    nearbyTherapeuticRecreationIntro: "This one is in your county and fits your child's age. It offers both fun activities and therapy. We are showing it as an extra — it did not change what we found above.",
    resourceSource: "Source",
    resourceVerified: "Checked on {date}",
    resourceAgeBand: "Age range",
    resourceContact: "How to start",
    resourceReferralMode: "How to get in",
    resourceHumanVerify: "Call and check before you count on this. Details change.",
    resourceFreshnessExpired: "This information is past Ladder's 45-day check window. Open the official page or call to confirm before relying on it.",
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
    resourceShareConsentRequired: "Check the consent box first — sharing needs your OK each time.",
    resourceOpenSource: "See their official page",
    resourceMore: "More about this",
    resourceLess: "Show less",
    resourceAbout: "About this program",
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
    timelineDevelopmentThirtyCta: "Open family check-ins",
    waitHeaderTitle: "Your Ladder",
    waitHeaderOnList: "On the list at {clinic} since {month} — about {months} months so far.",
    waitHeaderOnListFresh: "On the list at {clinic} since {month}.",
    waitHeaderNoPrediction: "We can't predict the exact date — here are steps you can choose while you wait.",
    rungSafety: "Please look at the safety message above",
    rungVisit: "Your evaluation visit needs a look",
    rungClinicNow: "Something to tell the clinic — see below",
    rungClock: "About {weeks} weeks left to start First Steps",
    rungClockRange: "See the First Steps cutoff dates",
    rungCheckin: "Monthly check-in (about 30 seconds)",
    rungStep: "Quick follow-up on a step you planned",
    rungJournal: "Add a 10-second note about your child",
    waitChipNotes: "{count} notes",
    waitChipNotesOne: "{count} note",
    waitChipSteps: "{count} steps in motion",
    waitChipStepsOne: "{count} step in motion",
    waitChipVisit: "Visit: {when}",
    waitChipSooner: "On the earlier-visit list",
    journalTitle: "Your notes so far",
    journalIntro: "Everything you've told us, in your words, with dates. This becomes your visit packet.",
    journalNotePlaceholder: "What did you notice this week? A sentence is plenty.",
    journalIncludeLabel: "Include in visit packet",
    journalExcludedBadge: "Not in packet",
    journalDeviceLine: "Notes stay on this device. Print or share a copy sometimes so you don't lose them.",
    journalExportNudge: "You have {count} notes now — a good moment to print or copy your visit packet.",
    journalMonthNote: "{month} — {count} notes",
    journalMonthNoteOne: "{month} — {count} note",
    journalEarlierGroup: "Earlier",
    packetHeading: "Our visit packet",
    packetBornLine: "born {year}",
    packetNoticedHeading: "What we noticed, over time",
    packetFlagsHeading: "Changes you may want to discuss",
    packetFlagRegression: "Possible loss of skills, noticed {month}",
    packetServicesHeading: "Services already in motion",
    packetStatusEnrolled: "enrolled",
    packetStatusInTouch: "in touch",
    packetQuestionsHeading: "Questions we want to ask",
    packetRideLine: "We may need help with transportation.",
    packetFooter: "Written from our own notes in Ladder · printed {date} · not a medical record. A clinician has not reviewed this packet.",
    packetQResultsSchool: "What do the results mean for school?",
    packetQCoordinatesNext: "Who coordinates the next steps?",
    packetQTherapyStart: "What options should we consider, and why?",
    packetQWaiverEffect: "Does this change our waiver applications?",
    packetQSchoolShare: "What should we share with the school?",
    packetQSecondVisit: "Will there be a follow-up visit?",
    packetQHomeHelp: "What can we keep doing at home?",
    packetQRegressionMeaning: "What does the change we noticed mean?",
    packetQSiblingsRisk: "Should the siblings be checked too?",
    packetQWhoToCall: "Who do we call with questions after today?",
    packetPrepTitle: "Getting ready for the visit",
    packetBringPacket: "Bring this packet — it's your notes in your words.",
    packetPickTitle: "Pick questions to bring",
    packetPrint: "Print",
    packetCopy: "Copy as text",
    packetCopied: "Copied.",
    packetCopyFailed:
      "This phone would not let us copy. The packet is on screen to read from, and Print and Save a copy still work.",
    packetSave: "Save a copy",
    packetSaved: "Saved to this device as a text file.",
    packetSaveFailed: "This phone would not save a file. Print it or copy it as text instead.",
    packetFileName: "visit-packet",
    packetShare: "Share this packet",
    packetShareConsent:
      "I understand this text includes my child's information and leaves this app when I share it.",
    packetShareReceipt: "Shared: the packet text, including your child's information.",
    packetShareCopiedReceipt: "Copied: the packet text, including your child's information.",
    packetShareUnavailable:
      "This phone would not open a share sheet or copy the text. Save a copy or print it instead.",
    stepPlanCta: "I'll do this",
    stepStatusPlanned: "Planned",
    stepStatusTried: "Tried",
    stepStatusInTouch: "In touch",
    stepStatusEnrolled: "Enrolled",
    stepStatusNotForUs: "Not for us",
    followupQuestion: "Last time you planned to contact {name} — how did it go?",
    followupGotThrough: "Got through",
    followupLeftMessage: "Left a message",
    followupNotYet: "Haven't yet",
    followupNotForUs: "Not for us",
    followupThanks: "Noted — it's in your packet's services section when it counts.",
    factRegressionLabel: "Change you noticed",
    factRegressionValue: "Possible loss of skills — from your words",
    extractionOnDevice:
      "We read this on your phone, not with the online assistant. Same words, simpler reading — check anything that looks off.",
    aiConsentTitle: "Want the online helper to read this too?",
    aiConsentBody:
      "We read the Ladder text you wrote here on your device, and Ladder has not sent that text or the child details you entered to its online helper. If you used dictation, your browser's speech service may already have processed microphone audio; this choice controls only Ladder text and child details. The online helper uses Ladder's online service and, when configured, OpenAI. If you turn it on, Ladder will try to send the words you type and the child details you entered to that service to sort topics and put program options in order; a configured service forwards them to OpenAI. It never contacts a clinic, and no clinician sees what you send. OpenAI may review requests it receives for safety and abuse monitoring. Your answer lasts until you close Ladder.",
    aiConsentAccept: "Use the online helper",
    aiConsentGranting: "Turning on the online helper…",
    aiConsentGrantError:
      "The online helper could not be turned on. Your words stayed on this device; you can try again or keep using the on-device path.",
    aiConsentUnavailableNotice:
      "The online helper is off because its short session ended. New words stay on this device; reload Ladder to check whether it is available again.",
    aiConsentDecline: "Keep everything on this device",
    aiConsentDeclinedNotice:
      "Ladder will keep your text and child details out of its online helper, and the programs below are matched here on your phone. Dictation may still use your browser's speech service for microphone audio.",
    aiConsentActiveTitle: "Online helper: On for this Ladder session",
    aiConsentActiveBody:
      "You can turn it off at any time. Turning it off stops new sends and cancels requests still in progress, but it cannot undo a request already sent.",
    aiConsentRevoke: "Turn off the online helper",
    aiUseNoneTitle: "No Ladder online-helper send this session",
    aiUseNoneBody:
      "You have not written anything in this Ladder session. When you do, it is read on this device unless you turn on the online helper.",
    aiUseOnDeviceTitle: "Read on this device this session",
    aiUseOnDeviceBody:
      "Everything you have written in this Ladder session was read here on your phone. No words or child details were sent to the online helper this session.",
    aiUseOnlineTitle: "Online-helper send attempted this session",
    aiUseOnlineBody:
      "You turned on the online helper, so Ladder attempted to send words you wrote and child details you entered off this device to its online service to sort topics and order options. When that service is connected to OpenAI, it forwards the request to OpenAI. Closing Ladder ends this choice; it cannot undo a request already sent.",
    aiHistoryNoneTitle: "No Ladder text activity is recorded",
    aiHistoryNoneBody:
      "This browser's saved activity contains no Ladder notes and no recorded online-helper send.",
    aiHistoryOnDeviceTitle: "No Ladder online-helper send is recorded",
    aiHistoryOnDeviceBody:
      "This browser contains Ladder notes, but its activity record does not show words or child details sent through Ladder's online helper.",
    aiHistoryOnlineTitle: "Ladder online-helper send recorded",
    aiHistoryOnlineBody:
      "This browser's activity shows that Ladder attempted to send words and child details to its online service to sort topics or order program options. When that service is connected to OpenAI, it forwards the request to OpenAI. New attempts appear in the activity log below; older live results may predate that log.",
    // F2a. Ladder's own safety words. These used to be the coach's, which are
    // written to an adult describing their own crisis — so a parent reporting
    // that their child wants to die was asked whether *they* felt unsafe and
    // told to put things they might hurt themselves with out of reach. The
    // detector returns a domain, never a subject: it cannot tell whether the
    // child or the caregiver is the person at risk. So these are written to be
    // read correctly either way rather than guessing, and each one keeps every
    // action the coach copy offered (988 voice, 988 text, 911).
    safetyHeading: "Someone may need urgent help",
    safetyMedicationHeading: "Check this medicine question with the care team",
    safetyCrisis:
      "Someone you are worried about may need urgent help right now. Call or text 988 to reach the 988 Suicide & Crisis Lifeline. It is free, confidential, available 24/7, and can help when you are worried about someone else. If anyone is in immediate danger, call 911. Ladder cannot monitor anyone's safety or contact anyone for you.",
    safetyAbuse:
      "Suspected child abuse or neglect should be reported now. In Kentucky, call 1-877-KYSAFE1 (1-877-597-2331). If anyone is in immediate danger, call 911. You can also tell the child's pediatrician, but you do not need to wait for a clinician to make the report. Ladder cannot make a report or contact anyone for you.",
    safetyHarmToOthers:
      "Keeping everyone safe comes first. If anyone is in immediate danger, call 911 now. If you are worried someone in your household may hurt another person or an animal, call or text 988 for crisis support; they also help people who are worried about someone else. If the concern is about a child, contact the child's pediatrician or go to the nearest emergency department for urgent help. Ladder cannot monitor anyone's safety or contact anyone for you.",
    safetySocial:
      "If your family has no food today, call 211 to connect with local food, housing, and utility resources. If anyone is in immediate danger, call 911. Ladder cannot request help or contact anyone for you.",
    safetyMedicationAccess:
      "If someone is out of insulin or another needed medicine, contact the prescriber or pharmacist now. If insulin cannot be obtained promptly, or if the person has symptoms that may be an emergency, seek urgent medical care; call 911 for an emergency. Ladder cannot contact anyone for you.",
    safetyMedicationChange:
      "Do not stop, start, or change a medicine dose based on Ladder. Contact the prescriber or care team to review the concern and decide what to do. Ladder can help organize the question, but it cannot change a prescription or contact the care team for you.",
    safetyMissingChild:
      "If a child is missing, act now: contact local law enforcement first. Then call the National Center for Missing & Exploited Children at 1-800-THE-LOST (1-800-843-5678). If there is immediate danger, call 911. Ladder cannot make a report or contact anyone for you.",
    safetyEmergency:
      "If this may be a medical emergency, call 911 now, or go to the nearest emergency department. Ladder cannot contact anyone for you.",
    safetySteps:
      "If you can do so safely, stay with the person who is struggling; secure or remove firearms, medicines, and other possible means; and tell another trusted adult what is happening.",
    safetyNoInterpretation:
      "We are not adding this message to your notes or turning it into a recap or facts. Ladder may keep a broad routing topic so relevant contacts and resources stay visible. County or age details from this message are used only on this page and are not saved.",
    safetyText988: "Text 988",
    safetyCallKySafe: "Call KYSAFE1 — report child abuse",
    safetyCall211: "Call 211 — local resources",
    safetyCallNcmec: "Call NCMEC — missing-child help",
    safetyDirectory:
      "This is the same directory after every urgent message; it does not reveal which kind of help was shown before. Use 988 for a mental-health crisis, KYSAFE1 to report suspected child abuse or neglect, 211 for food or basic needs, NCMEC for a missing child, a prescriber or pharmacist for missing medicine, and 911 for immediate danger.",
    safetyAcknowledge: "I understand — return to Ladder",
    safetyReopen: "Urgent help",
    safetyReopenHint: "You can reopen these contacts any time.",
    prototypeBannerTitle: "Ladder is a prototype — not a clinic service",
    prototypeBannerBody:
      "Use invented information only; do not enter real family or health details. No clinic is connected, and no one monitors these notes. Ladder organizes what you write and shows contacts; it does not diagnose, make referrals, book appointments, or send alerts.",
    // F3b/F3c. What Ladder is, and what it is not, in the two places a caregiver
    // is deciding whether to trust it: beside the privacy line, and at the front
    // door. Both are true in either posture — the simulation changes what is on
    // screen, never what the app can actually do.
    // The door gets the short form: spec 19 measured the first real card into the
    // second viewport at 375x812, and the full sentence pushed it past that. The
    // complete statement still renders beside the privacy line.
    serviceStatusShort: "Ladder is not connected to a clinic — it shows Kentucky contacts you can call yourself.",
    serviceStatusLine:
      "Ladder does not contact any clinic, make referrals, book appointments, or send anyone an alert. No person sees these notes unless you share them yourself. It organizes what you notice and shows Kentucky contacts you can call yourself.",
    programsCapped: "Showing {shown} of {count} places we found.",
    notesEmptyTitle: "No notes yet",
    notesEmptyBody:
      "The first one takes about 10 seconds — your words, with a date, kept on this phone.",
    clockHandoff:
      "The First Steps window has closed for {name} — it stops taking new referrals 45 days before the third birthday. The route now is the school district: ask in writing for a preschool special-education evaluation.",
    clockHandoffLink: "See what the school district owes you",
    icsCheckinFileName: "ladder-check-in",
    icsCheckinSummary: "Ladder check-in — how is {name} doing?",
    icsCheckinDescription:
      "About a month since your last note in Ladder. Open Ladder and add anything new or different.",
    icsVisitFileName: "ladder-visit",
    icsVisitSummary: "Evaluation visit — {clinic}",
    icsVisitDescription:
      "Bring your Ladder visit packet. Ladder set this reminder for 3 days before as well.",
    icsVisitAlarm: "Your visit at {clinic} is in 3 days. Print or save your packet.",
    remindTitle: "A way back",
    remindNextLine: "Your next check-in is around {date}.",
    remindCalendar: "Add to your calendar",
    remindCalendarWhy:
      "This is the reminder that works with Ladder closed — it goes in the calendar app you already use.",
    remindCalendarSaved: "Calendar file saved. Open it to add the reminder.",
    remindCalendarFailed: "This phone would not save a calendar file. Write the date down instead.",
    remindInApp: "Also remind me in the app",
    remindInAppOn: "In-app reminders are on.",
    remindInAppLimit:
      "Honest limit: this can only tell you while Ladder is open on this phone. There is no reminder that reaches a closed app — the calendar file is the one that does.",
    remindInAppBlocked: "This phone has notifications turned off for Ladder. The calendar file still works.",
    remindInAppUnsupported: "This phone cannot show app notifications. The calendar file still works.",
    remindNotificationTitle: "Ladder check-in",
    remindNotificationBody: "It's been about a month. Anything new or different?",
    factMarkWrong: "This is wrong",
    factMarkWrongHint:
      "Keeps your own words in your notes and stops us treating this as something you told us. It leaves the visit packet.",
    factMarkedWrong: "Marked wrong",
    clinicNowTitle: "Worth telling the clinic now",
    clinicNowBody:
      "Losing skills is worth reporting now — not waiting for the visit. Call {clinic}. It can matter for how soon your child is seen.",
    clinicNowBodyFirstSteps:
      "Losing skills is worth reporting now — not waiting for the visit. Call {office} — the First Steps point of entry for your county. It can matter for how soon your child is seen.",
    clinicNowBodyGeneric:
      "Losing skills is worth reporting now — not waiting for the visit. Call your child's doctor or clinic. It can matter for how soon your child is seen.",
    clinicNowAck: "I've noted this",
    checkinTitle: "Monthly check-in",
    checkinNoteInvite: "It's been about a month. Anything new or different with {name}?",
    checkinChildFallback: "your child",
    checkinAddNote: "Add a note",
    checkinNothingNew: "Nothing new",
    checkinProbe:
      "Compared with a few months ago, has {name} lost any skills — words, movements, things they could do?",
    checkinProbeNo: "No",
    checkinProbeUnsure: "Not sure",
    checkinProbeYes: "Yes, I think so",
    probeExamples:
      "Skill loss can look like: words that stopped, waving or pointing that went away, or steps backward in things like feeding or stairs.",
    probeExamplesSource: "Source: CDC, Learn the Signs. Act Early.",
    pulseQuestion: "How supported do you feel this month?",
    pulseSkip: "Skip",
    checkinSkip: "Skip check-in",
    checkinDone: "Thanks — see you next month.",
    checkinDemoControl: "Demo: pretend a month passed",
    guidesTitle: "Things to try at home",
    guidesIntro: "Small, checked ideas for the meantime — from the sources named on each card.",
    soonerQuestion:
      "Cancellations happen. If an earlier time opened up, could you take it on short notice?",
    soonerYes: "Yes, put us on the list",
    soonerNo: "No thanks",
    soonerMornings: "Weekday mornings",
    soonerAfternoons: "Weekday afternoons",
    soonerAnyWeekday: "Any weekday",
    soonerNotice: "We need 2+ days' notice",
    soonerConfirm: "Add us",
    soonerOnList: "On the earlier-visit list — you can leave any time.",
    soonerLeave: "Leave the list",
    soonerDemoCta: "An earlier opening appeared (demo)",
    soonerDecline: "Keep our current time",
    navOnThisPage: "On this page",
    navTell: "Tell us",
    navVisit: "Your visit",
    navResources: "Programs",
    navJournal: "Notes",
    navPacket: "Visit packet",
    backToTop: "Back to top",
    resourceDetailsToggle: "Details and source",
    heardStripPrefix: "From what you wrote: {parts}.",
    heardStripCounty: "{county} County",
    heardStripChild: "{child}, about {age} years old",
    heardStripChildOne: "{child}, about a year old",
    heardStripChildUnderOne: "{child}, under a year old",
    heardStripChildFallback: "your child",
    stripDisclosureSummary: "Check or change this",
    stripGuessesChip: "Check our guesses",
    stripTrustLine:
      "Your record is stored in this browser, on this device. Nothing is sent anywhere unless you turn on the online helper — and you can change any of it.",
    stripExtractedNote: "We read these from your words — check them.",
    threadResourcesTitle: "First places to try",
    seeAllResources: "See all {count} places below",
    seeAllResourcesOne: "See the {count} place below",
    fallbackInThread: "We did not find county programs for this yet — statewide starting points are below.",
    followUpOptional: "Optional — answering sharpens the list.",
    packetBasicsExtracted: "(read from your description — please check)",
    foldResourcesSummary: "All {count} places",
    foldResourcesSummaryOne: "{count} place",
    foldJournalSummary: "{count} notes · latest {month}",
    foldJournalSummaryOne: "{count} note · {month}",
    foldPacketSummary: "Print it or copy it",
    foldTimelineSummary: "{count} things to do now",
    foldTimelineSummaryOne: "{count} thing to do now",
    foldTimelineSummaryNone: "Nothing to do right now",
    tabHome: "Home",
    tabPrograms: "Programs",
    tabNotes: "Notes",
    tabVisit: "Visit",
    tabsLabel: "Ladder sections",
    shellExit: "All my health",
    shellHeaderSubtitle: "Tell us about your child and their needs",
    homeReturnTitle: "Welcome back. Here's what's waiting.",
    homeLastNote: "Last note: {date} · {ago}",
    agoToday: "today",
    agoDays: "{count} days ago",
    agoDaysOne: "yesterday",
    agoMonths: "about {count} months ago",
    agoMonthsOne: "about a month ago",
    homeChipOnListSince: "On the list since {month}",
    homeQueuedNext: "1 more thing after this: a quick follow-up on the {name} step you planned.",
    homeComposerCta: "Add a note — type or speak",
    homeComposerCtaNamed: "Add a note about {name} — type or speak",
    homeDoorProgramsMeta: "{count} matched",
    homeDoorProgramsMetaOne: "{count} matched",
    homeDoorVisitMeta: "on the list",
    homeDoorNotesMeta: "{count} notes in",
    homeDoorNotesMetaOne: "{count} note in",
    homeDoorNotesMetaNone: "nothing in yet",
    homeTrustLine:
      "Your notes are stored in this browser, on this device, and nothing is sent anywhere unless you turn on the online helper. We can't predict the exact evaluation date — here are steps you can choose while you wait.",
    notesEmptyCta: "Add the first note",
    visitTabNoticeTitle: "We added a Visit tab",
    visitTabNoticeBody:
      "You said {name} is on the list at {clinic}. We added a Visit tab to walk that wait with you.",
    visitTabNoticeOpen: "See it",
    visitTabNoticeDismiss: "Not now",
    clockFirstStepsDated:
      "About {weeks} weeks left to start First Steps — referrals close {date}. After the cutoff, the school system takes over referrals.",
    clockFirstStepsRange:
      "We only know {name}'s birth year, so the cutoff lands between {earliest} and {latest} — it depends on their birthday.",
    clockFirstStepsRangeOpen:
      "We only know {name}'s birth year. Depending on their birthday the cutoff may already have passed, or may be as late as {latest} — a call to First Steps can confirm the current rule and your options.",
    clockHeadline: "First Steps stops taking new referrals 45 days before {name} turns 3.",
    clockAddBirthMonth: "＋ Add their birth month — we'll name the date",
    clockAddBirthMonthHint: "Month only — not the full birthday.",
    clockBirthMonthSaved: "Saved. The cutoff date is named everywhere the clock appears.",
    resourceCallNumber: "Call {number}",
    resourceCallAlso: "or toll-free {number}",
    resourceStartOnline: "Start online",
    resourceAskProvider: "Ask your doctor for a referral",
    resourceContactSchool: "Contact the school",
    resourceAskNavigator: "Ask a navigator to help",
    resourceShareCopy: "Copy link",
    resourceShareUnavailable: "This phone would not open a share sheet or copy the link. Open the program's official page and share it from there.",
    resourceShareReceipt: "Sent: the program's name and link. Nothing about {child}.",
    resourceShareCopiedReceipt: "Link copied: the program's name and link. Nothing about {child}.",
    glossPoe: "Point of Entry — the local office that takes First Steps referrals.",
    glossIfsp: "IFSP — the written plan First Steps makes with your family.",
    glossIep: "IEP — the written plan the school must follow for your child.",
    gloss504: "504 plan — school supports without special-education classes.",
    glossArc: "ARC — Kentucky's name for the school meeting where your child's plan is decided.",
    apptNoneWork: "None of these work for us",
    apptKeepYourPlace:
      "You keep your place. Saying no to these times changes nothing about your spot on the list. We'll show new times when they open.",
    apptNeedsBookedVisit: "This needs a booked visit first — pick a time above.",
    askEyebrow: "Your next step"
  },
  es: {
    pageTitle: "Ladder — el desarrollo de tu hijo o hija",
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
    screenIntro: "Responde las que te sirvan y omite las demás — puedes volver a ellas más tarde. Decir que sí nos ayuda a encontrar los lugares correctos. No es un diagnóstico y no decide para qué calificas.",
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
    domainDiagnosisEducation: "Entender las opciones de evaluación",
    domainRecreation: "Recreación inclusiva",
    interviewTitle: "Cuéntanos sobre tu hijo o hija y sus necesidades",
    interviewIntro: "Cuéntanos qué has notado sobre cómo habla, aprende, se mueve o se comporta tu hijo o hija, y qué ya intentaste. Usamos tus propias palabras para buscar ayuda. Ladder no puede diagnosticar, decidir si tu hijo o hija califica para un programa, darte el resultado de una prueba, vigilar a tu hijo o hija, ni enviar una referencia por ti.",
    interviewLabel: "¿Con qué te gustaría recibir ayuda?",
    interviewPlaceholder: "Por ejemplo: Mi hijo tiene 3 años y casi no habla. El doctor dijo que esperáramos, pero estoy preocupada.",
    interviewDictationDisclosure:
      "El dictado usa el servicio de reconocimiento de voz de tu navegador, que puede procesar el audio del micrófono fuera de este dispositivo. Escribe para mantener el audio fuera de ese servicio.",
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
    evidencePatientReported: "De tus palabras",
    evidenceInferred: "Es una suposición — revísala",
    evidenceConfirmed: "Dijiste que está correcto",
    factSource: "Escribiste",
    evidenceTraceConversation: "Rastro de evidencia: {date} · {source} · {method}",
    evidenceTraceScreen: "Rastro de evidencia: respuestas guiadas · procesadas en este dispositivo",
    evidenceTraceOrphaned: "Rastro de evidencia: la nota original ya no está vinculada",
    evidenceCaptureTyped: "escrito",
    evidenceCaptureVoice: "hablado",
    evidenceCaptureMixed: "escrito y hablado",
    evidenceExtractionOnline: "ayudante en línea",
    evidenceExtractionOnDevice: "procesado en este dispositivo",
    factConfirm: "Sí, así es",
    factConfirmed: "Marcado como correcto",
    factNotRight: "No, no es así — déjalo fuera del paquete de la visita",
    factRowYes: "Sí",
    factRowNo: "No",
    factRowDetails: "Por qué lo escribimos",
    needsScreenDisclosureTitle: "¿Prefieres responder preguntas de sí o no?",
    needsScreenDisclosureBody: "Ocho preguntas rápidas en vez de escribir.",
    domainRationaleTitle: "Por qué te mostramos esto",
    factGradeLabel: "Grado",
    factReportedDiagnosisLabel: "Diagnóstico informado",
    factFunctionalBurdenLabel: "Impacto en la vida diaria",
    factFunctionalBurdenValue: "Las tareas escolares están tomando mucho tiempo",
    factPendingEvaluationLabel: "Estado de la evaluación",
    factPendingEvaluationValue: "Esperando una evaluación",
    factConcernSchoolLabel: "Sobre la escuela y el aprendizaje",
    factConcernSchoolValue: "Escribiste sobre la escuela y el aprendizaje",
    factConcernSpeechLabel: "Sobre el habla",
    factConcernSpeechValue: "Escribiste sobre el habla y el lenguaje",
    factConcernBehaviorLabel: "Sobre el comportamiento y las rutinas",
    factConcernBehaviorValue: "Escribiste sobre el comportamiento y las rutinas diarias",
    factConcernMotorLabel: "Sobre el movimiento",
    factConcernMotorValue: "Escribiste sobre el movimiento y la coordinación",
    rationaleEarlyIntervention: "Mencionaste el habla y tu hijo o hija tiene menos de tres años.",
    rationaleTherapies: "Mencionaste el habla, el lenguaje o la terapia.",
    rationaleSchoolIep: "Mencionaste la escuela, un IEP o ayuda con la lectura.",
    rationaleWaiversFinancial: "Preguntaste por exenciones o ayuda para pagar.",
    rationaleRespite: "Dijiste que necesitas un descanso del cuidado.",
    rationaleParentSupport: "Dijiste que te sientes abrumada o que no sabes por dónde empezar.",
    rationaleSiblingSupport: "Preguntaste por ayuda para un hermano o hermana.",
    rationaleTransportation: "Mencionaste que necesitas transporte o cómo llegar.",
    rationaleFuturePlanning: "Preguntaste por la vida adulta o por planificar el futuro.",
    rationaleDiagnosisEducation:
      "Pediste información verificada sobre opciones de evaluación sin poner una etiqueta.",
    rationaleRecreation: "Preguntaste por clubes, deportes, caballos o actividades.",
    apptSectionTitle: "Tu visita de evaluación",
    apptSectionIntro: "Ladder te acompaña desde la lista de espera hasta la visita: reservar, prepararte y resolver lo que pueda estorbar.",
    apptJoinDemoBody: "Esta demo supone que tu hijo o hija está en la lista de espera de UK Developmental Pediatrics. Nada de esto es una cita real.",
    apptJoinDemoCta: "Muéstrame (demo)",
    apptOnListLine: "En esta demo, están en la lista de {clinic}.",
    apptOfferQuestion: "En esta demo, hay un espacio para la evaluación. ¿Te sirve alguno de estos?",
    apptBookedLine: "Reservado para {when} (demo).",
    apptPrepTitle: "Cómo prepararte",
    apptPrepBullet1: "Lleva papeles de la escuela, evaluaciones anteriores y una lista de lo que has notado.",
    apptPrepBullet2: "La visita puede durar unas horas. Tu hijo o hija puede llevar algo que le ayude a sentirse en calma.",
    apptPrepBullet3: "Tú conoces mejor a tu hijo o hija. Tus respuestas son una parte importante de la evaluación.",
    apptPrepSource: "Aprende más: CDC, \"Learn the Signs. Act Early.\" (en inglés)",
    apptBarriersQuestion: "¿Hay algo que dificulte llegar a esta visita?",
    apptBarrierRide: "Necesitamos transporte",
    apptBarrierSiblings: "Alguien que cuide a los otros niños",
    apptBarrierWork: "Es difícil pedir permiso en el trabajo",
    apptBarrierNone: "Estamos listos",
    apptBarriersThanks: "Gracias — en esta demo, los recursos de abajo pueden ayudar y la visita simulada sigue reservada.",
    apptBarriersNoneThanks: "Genial — en esta demo, mostraremos recordatorios cuando se acerque la visita.",
    apptReminderT14: "Recordatorio de la demo: tu visita en {clinic} es en unas dos semanas — {when}. ¿Sigue en pie?",
    apptReminderT3: "Recordatorio de la demo: tu visita es en unos días — {when}. ¿Sigue en pie?",
    apptReminderT1: "Recordatorio de la demo: tu visita es mañana — {when}. ¿Sigue en pie?",
    apptReminderConfirm: "Sí, ahí estaremos",
    apptReminderReschedule: "Necesitamos otro horario",
    apptConfirmedLine: "Confirmado para {when} (demo).",
    apptOverdueQuestion: "La fecha de tu visita ya pasó. ¿Pudieron ir?",
    apptOverdueWent: "Sí fuimos",
    apptOverdueMissed: "No pudimos ir",
    apptCompletedLine: "Qué bueno que fueron (demo). En esta demo, la clínica da los próximos pasos mientras Ladder sigue ayudando.",
    apptMissedLine: "Así es la vida — en esta demo, no pierden su lugar. Busquemos una nueva fecha.",
    apptRebookCta: "Buscar nueva fecha",
    apptDemoControlsTitle: "Demo: acerca la visita",
    apptDemoTwoWeeks: "A unas 2 semanas",
    apptDemoFewDays: "A unos días",
    apptDemoTomorrow: "Mañana",
    apptDemoPassed: "La fecha pasó",
    apptSafetyHold: "En pausa mientras el mensaje de seguridad de arriba esté abierto.",
    resourcesTitle: "Lugares que pueden ayudar",
    preferencesTitle: "Qué te importa para la lista de programas (opcional)",
    preferencesSummary: "Dos opciones que Ladder sí puede usar para reordenar la lista.",
    preferencesIntro: "Elige solo si te resulta útil. Estas opciones cambian el orden, no los programas que aparecen.",
    preferencesHonesty: "Ladder no puede verificar cupos, costo, seguro, acceso en tu idioma, horarios ni elegibilidad. Confirma con la fuente antes de depender de un listado.",
    preferencesScopeLegend: "¿Qué alcance debe aparecer primero?",
    preferencesScopeNone: "Sin preferencia",
    preferencesScopeLocal: "Opciones cercanas o del condado primero",
    preferencesScopeStatewide: "Opciones estatales primero",
    preferencesContactLegend: "¿Qué tipo de primer paso te resulta más útil?",
    preferencesContactNone: "Sin preferencia",
    preferencesContactSelfServe: "Algo que pueda empezar en línea por mi cuenta",
    preferencesContactCall: "Una persona o navegador a quien pueda llamar",
    preferencesContactSchoolProvider: "Un paso por medio de la escuela o un profesional",
    preferencesSave: "Guardar preferencias de la lista",
    preferencesSaved: "Preferencias guardadas en este dispositivo.",
    resourcesIntro: "Esto se basa en tu condado, la edad de tu hijo o hija y lo que nos contaste. Revisa siempre la página del programa — sus reglas son las que valen.",
    basicsCountyQuestion: "Para buscar programas cerca de ti — ¿en qué condado de Kentucky vives?",
    basicsYearQuestion: "¿En qué año nació tu hijo o hija? Solo el año.",
    basicsStageQuestion: "¿Tu hijo o hija ya va a la escuela?",
    basicsTurnNext: "Siguiente",
    basicsOptionalNote:
      "Estos datos son opcionales. Sin ellos, Ladder no afirmará que un programa sea local ni adecuado para la edad.",
    basicsNotNow: "Ahora no — puedo agregarlos después",
    rankHeardFallback:
      "Esto se basa en lo que nos contaste, tu condado y la edad de tu hijo o hija. Revisa la página de cada programa — sus reglas son las que valen.",
    rankQuotePrefix: "Dijiste",
    rankUrgencyActNow: "Con plazo: regla de edad",
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
    resourceFreshnessExpired: "Esta información ya pasó el plazo de verificación de 45 días de Ladder. Abre la página oficial o llama para confirmar antes de confiar en ella.",
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
    resourceShareConsentRequired: "Marca primero la casilla — necesitamos tu permiso cada vez que compartas.",
    resourceOpenSource: "Ver su página oficial",
    resourceMore: "Más sobre esto",
    resourceLess: "Mostrar menos",
    resourceAbout: "Sobre este programa",
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
    timelineDevelopmentThirtyCta: "Abrir chequeos familiares",
    waitHeaderTitle: "Tu Ladder",
    waitHeaderOnList: "En la lista de {clinic} desde {month} — unos {months} meses hasta ahora.",
    waitHeaderOnListFresh: "En la lista de {clinic} desde {month}.",
    waitHeaderNoPrediction: "No podemos predecir la fecha exacta — aquí tienes pasos que puedes elegir mientras esperas.",
    rungSafety: "Por favor mira el mensaje de seguridad de arriba",
    rungVisit: "Tu visita de evaluación necesita atención",
    rungClinicNow: "Algo que contarle a la clínica — mira abajo",
    rungClock: "Quedan unas {weeks} semanas para empezar First Steps",
    rungClockRange: "Ver las fechas de corte de First Steps",
    rungCheckin: "Chequeo mensual (unos 30 segundos)",
    rungStep: "Seguimiento rápido de un paso que planeaste",
    rungJournal: "Agrega una nota de 10 segundos sobre tu hijo o hija",
    waitChipNotes: "{count} notas",
    waitChipNotesOne: "{count} nota",
    waitChipSteps: "{count} pasos en marcha",
    waitChipStepsOne: "{count} paso en marcha",
    waitChipVisit: "Visita: {when}",
    waitChipSooner: "En la lista de visita anticipada",
    journalTitle: "Tus notas hasta ahora",
    journalIntro: "Todo lo que nos has contado, en tus palabras, con fechas. Esto se convierte en tu paquete para la visita.",
    journalNotePlaceholder: "¿Qué notaste esta semana? Con una frase basta.",
    journalIncludeLabel: "Incluir en el paquete de la visita",
    journalExcludedBadge: "Fuera del paquete",
    journalDeviceLine: "Las notas se quedan en este dispositivo. Imprime o comparte una copia de vez en cuando para no perderlas.",
    journalExportNudge: "Ya tienes {count} notas — buen momento para imprimir o copiar tu paquete.",
    journalMonthNote: "{month} — {count} notas",
    journalMonthNoteOne: "{month} — {count} nota",
    journalEarlierGroup: "Antes",
    packetHeading: "Nuestro paquete para la visita",
    packetBornLine: "nace en {year}",
    packetNoticedHeading: "Lo que notamos, con el tiempo",
    packetFlagsHeading: "Cambios que quizás quieras comentar",
    packetFlagRegression: "Posible pérdida de habilidades, notada en {month}",
    packetServicesHeading: "Servicios ya en marcha",
    packetStatusEnrolled: "inscrito",
    packetStatusInTouch: "en contacto",
    packetQuestionsHeading: "Preguntas que queremos hacer",
    packetRideLine: "Podríamos necesitar ayuda con el transporte.",
    packetFooter: "Escrito con nuestras propias notas en Ladder · impreso {date} · no es un expediente médico. Ningún profesional clínico ha revisado este paquete.",
    packetQResultsSchool: "¿Qué significan los resultados para la escuela?",
    packetQCoordinatesNext: "¿Quién coordina los próximos pasos?",
    packetQTherapyStart: "¿Qué opciones deberíamos considerar, y por qué?",
    packetQWaiverEffect: "¿Esto cambia nuestras solicitudes de exención?",
    packetQSchoolShare: "¿Qué debemos compartir con la escuela?",
    packetQSecondVisit: "¿Habrá una visita de seguimiento?",
    packetQHomeHelp: "¿Qué podemos seguir haciendo en casa?",
    packetQRegressionMeaning: "¿Qué significa el cambio que notamos?",
    packetQSiblingsRisk: "¿Deberíamos revisar también a los hermanos?",
    packetQWhoToCall: "¿A quién llamamos si tenemos preguntas después de hoy?",
    packetPrepTitle: "Prepararse para la visita",
    packetBringPacket: "Lleva este paquete — son tus notas en tus palabras.",
    packetPickTitle: "Elige preguntas para llevar",
    packetCopyFailed:
      "Este teléfono no nos dejó copiar. El paquete está en la pantalla para leerlo, y Imprimir y Guardar una copia siguen funcionando.",
    packetSave: "Guardar una copia",
    packetSaved: "Guardado en este dispositivo como archivo de texto.",
    packetSaveFailed: "Este teléfono no pudo guardar un archivo. Imprímelo o cópialo como texto.",
    packetFileName: "paquete-de-visita",
    packetShare: "Compartir este paquete",
    packetShareConsent:
      "Entiendo que este texto incluye información de mi hijo o hija y sale de esta aplicación cuando lo comparto.",
    packetShareReceipt: "Compartido: el texto del paquete, con la información de tu hijo o hija.",
    packetShareCopiedReceipt: "Copiado: el texto del paquete, con la información de tu hijo o hija.",
    packetShareUnavailable:
      "Este teléfono no abrió una hoja para compartir ni copió el texto. Guarda una copia o imprímelo.",
    packetPrint: "Imprimir",
    packetCopy: "Copiar como texto",
    packetCopied: "Copiado.",
    stepPlanCta: "Voy a hacerlo",
    stepStatusPlanned: "Planeado",
    stepStatusTried: "Intentado",
    stepStatusInTouch: "En contacto",
    stepStatusEnrolled: "Inscrito",
    stepStatusNotForUs: "No es para nosotros",
    followupQuestion: "La última vez planeaste contactar a {name} — ¿cómo te fue?",
    followupGotThrough: "Logré comunicarme",
    followupLeftMessage: "Dejé un mensaje",
    followupNotYet: "Todavía no",
    followupNotForUs: "No es para nosotros",
    followupThanks: "Anotado — aparecerá en la sección de servicios de tu paquete cuando cuente.",
    factRegressionLabel: "Cambio que notaste",
    factRegressionValue: "Posible pérdida de habilidades — según tus palabras",
    extractionOnDevice:
      "Esto lo leímos en tu teléfono, no con el asistente en línea. Las mismas palabras, una lectura más sencilla — revisa cualquier cosa que se vea mal.",
    aiConsentTitle: "¿Quieres que el asistente en línea también lea esto?",
    aiConsentBody:
      "Leímos en tu dispositivo el texto que escribiste en Ladder, y Ladder no ha enviado ese texto ni los datos del niño o la niña que ingresaste a su asistente en línea. Si usaste el dictado, es posible que el servicio de reconocimiento de voz de tu navegador ya haya procesado el audio del micrófono; esta elección controla solo el texto de Ladder y los datos del menor. El asistente en línea usa el servicio en línea de Ladder y, cuando está configurado, OpenAI. Si lo activas, Ladder intentará enviar a ese servicio las palabras que escribes y los datos del niño o la niña que ingresaste para ordenar los temas y las opciones de programas; un servicio configurado los reenvía a OpenAI. Nunca se comunica con una clínica, y ningún profesional clínico ve lo que envías. OpenAI puede revisar las solicitudes que recibe para seguridad y control de abuso. Tu respuesta dura hasta que cierres Ladder.",
    aiConsentAccept: "Usar el asistente en línea",
    aiConsentGranting: "Activando el asistente en línea…",
    aiConsentGrantError:
      "No se pudo activar el asistente en línea. Tus palabras permanecieron en este dispositivo; puedes intentarlo de nuevo o seguir usando la opción del dispositivo.",
    aiConsentUnavailableNotice:
      "El asistente en línea está desactivado porque terminó su sesión breve. Las palabras nuevas permanecen en este dispositivo; vuelve a cargar Ladder para comprobar si está disponible otra vez.",
    aiConsentDecline: "Mantener todo en este dispositivo",
    aiConsentDeclinedNotice:
      "Ladder mantendrá tu texto y los datos del menor fuera de su asistente en línea, y los programas de abajo se emparejan aquí en tu teléfono. El dictado aún puede usar el servicio de reconocimiento de voz de tu navegador para el audio del micrófono.",
    aiConsentActiveTitle: "Asistente en línea: activado para esta sesión de Ladder",
    aiConsentActiveBody:
      "Puedes desactivarlo en cualquier momento. Al desactivarlo se detienen los envíos nuevos y se cancelan las solicitudes en curso, pero no se puede deshacer una solicitud ya enviada.",
    aiConsentRevoke: "Desactivar el asistente en línea",
    aiUseNoneTitle: "No hubo un envío al asistente en línea de Ladder en esta sesión",
    aiUseNoneBody:
      "Todavía no has escrito nada en esta sesión de Ladder. Cuando lo hagas, se lee en este dispositivo a menos que actives el asistente en línea.",
    aiUseOnDeviceTitle: "Leído en este dispositivo en esta sesión",
    aiUseOnDeviceBody:
      "Todo lo que has escrito en esta sesión de Ladder se leyó aquí en tu teléfono. No se enviaron palabras ni datos del niño o la niña al asistente en línea en esta sesión.",
    aiUseOnlineTitle: "Intento de envío al asistente en línea en esta sesión",
    aiUseOnlineBody:
      "Activaste el asistente en línea, así que Ladder intentó enviar fuera de este dispositivo las palabras que escribiste y los datos del niño o la niña que ingresaste a su servicio en línea para ordenar los temas y las opciones. Cuando ese servicio está conectado a OpenAI, reenvía la solicitud a OpenAI. Cerrar Ladder termina esta elección; no puede deshacer una solicitud ya enviada.",
    aiHistoryNoneTitle: "No hay actividad de texto de Ladder registrada",
    aiHistoryNoneBody:
      "La actividad guardada en este navegador no contiene notas de Ladder ni un envío registrado al asistente en línea.",
    aiHistoryOnDeviceTitle: "No hay un envío de Ladder al asistente en línea registrado",
    aiHistoryOnDeviceBody:
      "Este navegador contiene notas de Ladder, pero su registro de actividad no muestra palabras ni datos del niño o la niña enviados mediante el asistente en línea de Ladder.",
    aiHistoryOnlineTitle: "Se registró un intento de envío de Ladder al asistente en línea",
    aiHistoryOnlineBody:
      "La actividad de este navegador muestra que Ladder intentó enviar palabras y datos del niño o la niña a su servicio en línea para ordenar temas u opciones de programas. Cuando ese servicio está conectado a OpenAI, reenvía la solicitud a OpenAI. Los intentos nuevos aparecen en el registro de actividad de abajo; es posible que los resultados en línea anteriores sean previos a ese registro.",
    safetyHeading: "Alguien puede necesitar ayuda urgente",
    safetyMedicationHeading: "Consulta esta pregunta sobre medicamentos con el equipo de salud",
    safetyCrisis:
      "Alguien que te preocupa puede necesitar ayuda urgente ahora mismo. Llama al 988 o envía AYUDA al 988 para comunicarte con la Línea 988 de Prevención del Suicidio y Crisis. Es gratis, confidencial y está disponible las 24 horas, todos los días; también ayuda cuando te preocupa otra persona. Si alguien está en peligro inmediato, llama al 911. Ladder no puede vigilar la seguridad de nadie ni comunicarse con nadie por ti.",
    safetyAbuse:
      "La sospecha de abuso o negligencia infantil debe reportarse ahora. En Kentucky, llama al 1-877-KYSAFE1 (1-877-597-2331). Si alguien está en peligro inmediato, llama al 911. También puedes informar al pediatra del menor, pero no necesitas esperar a un profesional clínico para hacer el reporte. Ladder no puede hacer un reporte ni comunicarse con nadie por ti.",
    safetyHarmToOthers:
      "La seguridad de todos es lo primero. Si alguien está en peligro inmediato, llama al 911 ahora. Si te preocupa que alguien en tu hogar pueda lastimar a otra persona o a un animal, llama al 988 o envía AYUDA al 988 para obtener apoyo en una crisis; también ayudan a quienes están preocupados por otra persona. Si la preocupación es por un menor, comunícate con su pediatra o ve a la sala de emergencias más cercana para obtener ayuda urgente. Ladder no puede vigilar la seguridad de nadie ni comunicarse con nadie por ti.",
    safetySocial:
      "Si tu familia no tiene comida hoy, llama al 211 para conectarte con recursos locales de comida, vivienda y servicios básicos. Si alguien está en peligro inmediato, llama al 911. Ladder no puede solicitar ayuda ni comunicarse con nadie por ti.",
    safetyMedicationAccess:
      "Si alguien se quedó sin insulina u otro medicamento necesario, comunícate ahora con quien lo recetó o con una farmacia. Si no se puede conseguir insulina pronto, o si la persona tiene síntomas que pueden ser una emergencia, busca atención médica urgente; llama al 911 si es una emergencia. Ladder no puede comunicarse con nadie por ti.",
    safetyMedicationChange:
      "No suspendas, empieces ni cambies la dosis de un medicamento basándote en Ladder. Comunícate con quien lo recetó o con el equipo de salud para revisar la inquietud y decidir qué hacer. Ladder puede ayudarte a organizar la pregunta, pero no puede cambiar una receta ni comunicarse con el equipo por ti.",
    safetyMissingChild:
      "Si un menor está desaparecido, actúa ahora: comunícate primero con la policía local. Después llama al Centro Nacional para Menores Desaparecidos y Explotados al 1-800-THE-LOST (1-800-843-5678). Si hay peligro inmediato, llama al 911. Ladder no puede hacer un reporte ni comunicarse con nadie por ti.",
    safetyEmergency:
      "Si esto puede ser una emergencia médica, llama al 911 ahora, o ve a la sala de emergencias más cercana. Ladder no puede comunicarse con nadie por ti.",
    safetySteps:
      "Si puedes hacerlo de forma segura, quédate con la persona que está sufriendo; guarda bajo llave o retira las armas de fuego, los medicamentos y otros posibles medios; y cuéntale lo que ocurre a otro adulto de confianza.",
    safetyNoInterpretation:
      "No agregamos este mensaje a tus notas ni lo convertimos en un resumen o en datos. Ladder puede guardar un tema general de enrutamiento para mantener visibles los contactos y recursos relevantes. Los datos de condado o edad de este mensaje se usan solo en esta página y no se guardan.",
    safetyText988: "Envía AYUDA al 988",
    safetyCallKySafe: "Llama a KYSAFE1 — reportar abuso infantil",
    safetyCall211: "Llama al 211 — recursos locales",
    safetyCallNcmec: "Llama a NCMEC — ayuda para menores desaparecidos",
    safetyDirectory:
      "Este es el mismo directorio después de cualquier mensaje urgente; no revela qué tipo de ayuda se mostró antes. Usa el 988 para una crisis de salud mental, KYSAFE1 para reportar sospechas de abuso o negligencia infantil, el 211 para comida o necesidades básicas, NCMEC para un menor desaparecido, quien recetó el medicamento o una farmacia si falta medicina, y el 911 para peligro inmediato.",
    safetyAcknowledge: "Entiendo — volver a Ladder",
    safetyReopen: "Ayuda urgente",
    safetyReopenHint: "Puedes volver a abrir estos contactos cuando quieras.",
    prototypeBannerTitle: "Ladder es un prototipo — no es un servicio de una clínica",
    prototypeBannerBody:
      "Usa solo información inventada; no ingreses datos reales de una familia ni datos de salud. No hay ninguna clínica conectada y nadie vigila estas notas. Ladder organiza lo que escribes y muestra contactos; no diagnostica, no hace referencias, no reserva citas ni envía alertas.",
    serviceStatusShort: "Ladder no está conectado con una clínica — te muestra contactos de Kentucky a los que puedes llamar tú mismo.",
    serviceStatusLine:
      "Ladder no se comunica con ninguna clínica, no hace referencias, no reserva citas ni le avisa a nadie. Ninguna persona ve estas notas a menos que tú las compartas. Organiza lo que observas y te muestra contactos de Kentucky a los que puedes llamar tú mismo.",
    programsCapped: "Mostrando {shown} de {count} lugares que encontramos.",
    notesEmptyTitle: "Todavía no hay notas",
    notesEmptyBody:
      "La primera toma unos 10 segundos — tus palabras, con fecha, guardadas en este teléfono.",
    clockHandoff:
      "La ventana de First Steps se cerró para {name} — deja de aceptar referencias nuevas 45 días antes del tercer cumpleaños. Ahora la ruta es el distrito escolar: pide por escrito una evaluación de educación especial preescolar.",
    clockHandoffLink: "Mira lo que te debe el distrito escolar",
    icsCheckinFileName: "chequeo-ladder",
    icsCheckinSummary: "Chequeo de Ladder — ¿cómo va {name}?",
    icsCheckinDescription:
      "Ha pasado como un mes desde tu última nota en Ladder. Abre Ladder y agrega algo nuevo o diferente.",
    icsVisitFileName: "visita-ladder",
    icsVisitSummary: "Visita de evaluación — {clinic}",
    icsVisitDescription:
      "Lleva tu paquete de la visita de Ladder. Ladder también puso un recordatorio 3 días antes.",
    icsVisitAlarm: "Tu visita en {clinic} es en 3 días. Imprime o guarda tu paquete.",
    remindTitle: "Una forma de volver",
    remindNextLine: "Tu próximo chequeo es alrededor del {date}.",
    remindCalendar: "Agregar a tu calendario",
    remindCalendarWhy:
      "Este es el recordatorio que funciona con Ladder cerrado — se guarda en la aplicación de calendario que ya usas.",
    remindCalendarSaved: "Archivo de calendario guardado. Ábrelo para agregar el recordatorio.",
    remindCalendarFailed:
      "Este teléfono no pudo guardar un archivo de calendario. Mejor anota la fecha.",
    remindInApp: "También recuérdame en la aplicación",
    remindInAppOn: "Los recordatorios en la aplicación están activados.",
    remindInAppLimit:
      "Límite honesto: esto solo puede avisarte mientras Ladder esté abierto en este teléfono. No existe un recordatorio que llegue a una aplicación cerrada — el archivo de calendario sí lo hace.",
    remindInAppBlocked:
      "Este teléfono tiene las notificaciones desactivadas para Ladder. El archivo de calendario sigue funcionando.",
    remindInAppUnsupported:
      "Este teléfono no puede mostrar notificaciones de la aplicación. El archivo de calendario sigue funcionando.",
    remindNotificationTitle: "Chequeo de Ladder",
    remindNotificationBody: "Ha pasado como un mes. ¿Algo nuevo o diferente?",
    factMarkWrong: "Esto no es correcto",
    factMarkWrongHint:
      "Guarda tus propias palabras en tus notas y deja de tratar esto como algo que nos dijiste. Sale del paquete de la visita.",
    factMarkedWrong: "Marcado como incorrecto",
    clinicNowTitle: "Vale la pena avisar a la clínica ahora",
    clinicNowBody:
      "Perder habilidades vale la pena reportarlo ahora — sin esperar la visita. Llama a {clinic}. Puede influir en qué tan pronto atienden a tu hijo o hija.",
    clinicNowBodyFirstSteps:
      "Perder habilidades vale la pena reportarlo ahora — sin esperar la visita. Llama a {office} — el punto de entrada de First Steps para tu condado. Puede influir en qué tan pronto atienden a tu hijo o hija.",
    clinicNowBodyGeneric:
      "Perder habilidades vale la pena reportarlo ahora — sin esperar la visita. Llama al doctor o a la clínica de tu hijo o hija. Puede influir en qué tan pronto atienden a tu hijo o hija.",
    clinicNowAck: "Lo tengo anotado",
    checkinTitle: "Chequeo mensual",
    checkinNoteInvite: "Ha pasado como un mes. ¿Algo nuevo o diferente con {name}?",
    checkinChildFallback: "tu hijo o hija",
    checkinAddNote: "Agregar una nota",
    checkinNothingNew: "Nada nuevo",
    checkinProbe:
      "Comparado con hace unos meses, ¿{name} ha perdido habilidades — palabras, movimientos, cosas que ya hacía?",
    checkinProbeNo: "No",
    checkinProbeUnsure: "No estoy segura",
    checkinProbeYes: "Sí, creo que sí",
    probeExamples:
      "La pérdida de habilidades puede verse así: palabras que dejaron de decirse, saludar o señalar que desapareció, o retrocesos en comer o subir escaleras.",
    probeExamplesSource: "Fuente: CDC, Learn the Signs. Act Early. (en inglés)",
    pulseQuestion: "¿Qué tan apoyada o apoyado te sientes este mes?",
    pulseSkip: "Omitir",
    checkinSkip: "Omitir el chequeo",
    checkinDone: "Gracias — nos vemos el próximo mes.",
    checkinDemoControl: "Demo: imagina que pasó un mes",
    guidesTitle: "Cosas para probar en casa",
    guidesIntro:
      "Ideas pequeñas y verificadas para mientras tanto — de las fuentes que aparecen en cada tarjeta.",
    soonerQuestion:
      "A veces hay cancelaciones. Si se abriera un horario más temprano, ¿podrían tomarlo con poco aviso?",
    soonerYes: "Sí, anótanos en la lista",
    soonerNo: "No, gracias",
    soonerMornings: "Mañanas entre semana",
    soonerAfternoons: "Tardes entre semana",
    soonerAnyWeekday: "Cualquier día entre semana",
    soonerNotice: "Necesitamos 2+ días de aviso",
    soonerConfirm: "Anótanos",
    soonerOnList: "En la lista de visita anticipada — puedes salirte cuando quieras.",
    soonerLeave: "Salir de la lista",
    soonerDemoCta: "Se abrió un lugar antes (demo)",
    soonerDecline: "Mantener nuestro horario",
    navOnThisPage: "En esta página",
    navTell: "Cuéntanos",
    navVisit: "Tu visita",
    navResources: "Programas",
    navJournal: "Notas",
    navPacket: "Paquete para la visita",
    resourceCountyServiceArea: "Atiende al condado de {county}",
    resourceStatewideServiceArea: "Disponible en todo el estado",
    resourceMatchReason: "Se muestra por: {need}.",
    backToTop: "Volver arriba",
    resourceDetailsToggle: "Detalles y fuente",
    heardStripPrefix: "Según lo que escribiste: {parts}.",
    heardStripCounty: "condado de {county}",
    heardStripChild: "{child}, de unos {age} años",
    heardStripChildOne: "{child}, de alrededor de un año",
    heardStripChildUnderOne: "{child}, de menos de un año",
    heardStripChildFallback: "tu hijo o hija",
    stripDisclosureSummary: "Revisa o cambia esto",
    stripGuessesChip: "Revisa nuestras suposiciones",
    stripTrustLine:
      "Tu registro se guarda en este navegador, en este dispositivo. No se envía nada a ninguna parte a menos que actives el asistente en línea — y puedes cambiar lo que quieras.",
    stripExtractedNote: "Esto lo leímos de tus palabras — revísalo.",
    threadResourcesTitle: "Primeros lugares para intentar",
    seeAllResources: "Ver los {count} lugares de abajo",
    seeAllResourcesOne: "Ver el {count} lugar de abajo",
    fallbackInThread: "Todavía no encontramos programas de tu condado para esto — abajo hay opciones de todo el estado.",
    followUpOptional: "Opcional — responder afina la lista.",
    packetBasicsExtracted: "(leído de tu descripción — por favor revísalo)",
    foldResourcesSummary: "Los {count} lugares",
    foldResourcesSummaryOne: "{count} lugar",
    foldJournalSummary: "{count} notas · la última de {month}",
    foldJournalSummaryOne: "{count} nota · {month}",
    foldPacketSummary: "Imprímelo o cópialo",
    foldTimelineSummary: "{count} cosas para hacer ahora",
    foldTimelineSummaryOne: "{count} cosa para hacer ahora",
    foldTimelineSummaryNone: "Nada que hacer por ahora",
    tabHome: "Inicio",
    tabPrograms: "Programas",
    tabNotes: "Notas",
    tabVisit: "Cita",
    tabsLabel: "Secciones de Ladder",
    shellExit: "Toda mi salud",
    shellHeaderSubtitle: "Cuéntanos sobre tu hijo o hija y sus necesidades",
    homeReturnTitle: "Hola de nuevo. Esto es lo que hay pendiente.",
    homeLastNote: "Última nota: {date} · {ago}",
    agoToday: "hoy",
    agoDays: "hace {count} días",
    agoDaysOne: "ayer",
    agoMonths: "hace unos {count} meses",
    agoMonthsOne: "hace un mes",
    homeChipOnListSince: "En la lista desde {month}",
    homeQueuedNext: "Después de esto queda 1 cosa: una pregunta corta sobre el paso de {name} que planeaste.",
    homeComposerCta: "Agregar una nota — escribe o habla",
    homeComposerCtaNamed: "Agregar una nota sobre {name} — escribe o habla",
    homeDoorProgramsMeta: "{count} encontrados",
    homeDoorProgramsMetaOne: "{count} encontrado",
    homeDoorVisitMeta: "en la lista",
    homeDoorNotesMeta: "{count} notas dentro",
    homeDoorNotesMetaOne: "{count} nota dentro",
    homeDoorNotesMetaNone: "todavía nada dentro",
    homeTrustLine:
      "Tus notas se guardan en este navegador, en este dispositivo, y no se envía nada a ninguna parte a menos que actives el asistente en línea. No podemos predecir la fecha exacta de la evaluación — aquí tienes pasos que puedes elegir mientras esperas.",
    notesEmptyCta: "Agregar la primera nota",
    visitTabNoticeTitle: "Agregamos una pestaña Cita",
    visitTabNoticeBody:
      "Dijiste que {name} está en la lista de {clinic}. Agregamos una pestaña Cita para acompañarte durante la espera.",
    visitTabNoticeOpen: "Verla",
    visitTabNoticeDismiss: "Ahora no",
    clockFirstStepsDated:
      "Quedan unas {weeks} semanas para empezar First Steps — los referidos cierran el {date}. Después del corte, el sistema escolar se encarga de los referidos.",
    clockFirstStepsRange:
      "Solo sabemos el año de nacimiento de {name}, así que el corte cae entre {earliest} y {latest} — depende de su cumpleaños.",
    clockFirstStepsRangeOpen:
      "Solo sabemos el año de nacimiento de {name}. Según su cumpleaños, el corte ya pudo haber pasado o puede ser tan tarde como {latest} — una llamada a First Steps puede confirmar la regla actual y tus opciones.",
    clockHeadline: "First Steps deja de aceptar referidos nuevos 45 días antes de que {name} cumpla 3 años.",
    clockAddBirthMonth: "＋ Agrega su mes de nacimiento — te diremos la fecha",
    clockAddBirthMonthHint: "Solo el mes — no la fecha completa.",
    clockBirthMonthSaved: "Guardado. La fecha de corte aparece en todos los lugares donde va el reloj.",
    resourceCallNumber: "Llamar al {number}",
    resourceCallAlso: "o gratis al {number}",
    resourceStartOnline: "Empezar en línea",
    resourceAskProvider: "Pídele un referido a tu doctor",
    resourceContactSchool: "Comunícate con la escuela",
    resourceAskNavigator: "Pide ayuda a un navegante",
    resourceShareCopy: "Copiar enlace",
    resourceShareUnavailable: "Este teléfono no abrió la hoja para compartir ni copió el enlace. Abre la página oficial del programa y compártela desde ahí.",
    resourceShareReceipt: "Enviado: el nombre del programa y el enlace. Nada sobre {child}.",
    resourceShareCopiedReceipt: "Enlace copiado: el nombre del programa y el enlace. Nada sobre {child}.",
    glossPoe: "Punto de entrada — la oficina local que recibe los referidos de First Steps.",
    glossIfsp: "IFSP — el plan escrito que First Steps hace con tu familia.",
    glossIep: "IEP — el plan escrito que la escuela tiene que seguir para tu hijo o hija.",
    gloss504: "Plan 504 — apoyos en la escuela sin clases de educación especial.",
    glossArc: "ARC — así se llama en Kentucky la reunión escolar donde se decide el plan de tu hijo o hija.",
    apptNoneWork: "Ninguno de estos nos sirve",
    apptKeepYourPlace:
      "Conservas tu lugar. Decir que no a estos horarios no cambia nada en tu lugar de la lista. Te mostraremos horarios nuevos cuando se abran.",
    apptNeedsBookedVisit: "Esto necesita una cita reservada primero — elige un horario arriba.",
    askEyebrow: "Tu próximo paso"
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
