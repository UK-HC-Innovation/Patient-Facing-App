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
  | "voiceErrorLine"
  | "fallbackNotice"
  | "askPlaceholder"
  | "askButton"
  | "liveTypedHint"
  | "visionEstimateBadge"
  | "labelPhotoRegion"
  | "labelScoreFromPhoto"
  | "labelReadingPhoto"
  | "labelReadFailure"
  | "labelPhotoEstimateBadge"
  | "labelPhotoCheck"
  | "labelServingUnknown"
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
  | "portionChipHalf"
  | "portionChipAbout"
  | "portionChipDouble"
  | "nutritionCalories"
  | "nutritionSodium"
  | "nutritionCarbs"
  | "nutritionAddedSugars"
  | "nutritionSaturatedFat"
  | "todaySoFar"
  | "todayTotalLine"
  | "todayTotalIncomplete"
  | "logThis"
  | "loggedConfirmation"
  | "addToPlate"
  | "plateTitle"
  | "plateItemScore"
  | "plateNoScore"
  | "plateAverage"
  | "plateIncomplete"
  | "plateRemove"
  | "plateDecrease"
  | "plateIncrease"
  | "plateServings"
  | "plateNutritionTitle"
  | "plateLog"
  | "plateScanButton"
  | "plateScanBusy"
  | "plateScanFailed"
  | "plateScanUnavailable"
  | "plateScanEmpty"
  | "plateSkipped"
  | "platePortionBasis"
  | "plateCarbRange"
  | "plateCarbEstimateNote"
  | "recentMealsTitle"
  | "noMealsYet"
  | "foodNotThis"
  | "savedFoodsTitle"
  | "favoritesTitle"
  | "foodRecentsTitle"
  | "savedFoodRescore"
  | "favoriteAdd"
  | "favoriteRemove"
  | "favoriteAddShort"
  | "favoriteRemoveShort"
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
  | "scoreGlucosePattern"
  | "foodHistoryLogged"
  | "foodHistoryReading"
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
  | "flagDayTotalSodium"
  | "flagDayTotalCarbs"
  | "flagDayTotalAddedSugars"
  | "flagDayTotalSaturatedFat"
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
  | "compassWhyScore"
  | "compassNotAssessable"
  | "compassPartlyAssessable"
  | "compassDomainD1"
  | "compassDomainD2"
  | "compassDomainD3"
  | "compassDomainD4"
  | "compassDomainD5"
  | "compassDomainD6"
  | "compassDomainD7"
  | "compassDomainD8"
  | "compassDomainD9"
  | "guidanceGeneral"
  | "guidancePersonalized"
  | "demoPizzaPreview"
  | "demoCameraUnavailable"
  | "compassScoreDetails"
  | "compassIdentifiedFood"
  | "compassKcalPer100g"
  | "compassPageTitle"
  | "compassPageDescription"
  | "compassIdleEnded"
  | "compassIdleStarting"
  | "compassIdleAwaiting"
  | "compassCameraRegion"
  | "compassResultRegion"
  | "compassSortLegend"
  | "compassSortScore"
  | "compassSortDensity"
  | "compassNoPublishedScore"
  | "compassOrderInterpretation"
  | "compassWeHeard"
  | "compassRestaurant"
  | "compassFood"
  | "compassToppings"
  | "compassCrust"
  | "compassSize"
  | "compassNotSpecified"
  | "compassClosestPublished"
  | "compassNotRepresented"
  | "compassChooseCloser"
  | "nutritionProtein"
  | "nutritionFiber"
  | "nutritionPotassium"
  | "compassPer100g"
  | "compassNoNutrientPanel"
  | "compassBetterOptionsSorted"
  | "compassSortedScore"
  | "compassSortedDensity"
  | "compassHowScoringWorks"
  | "compassScoreSource"
  | "compassMethodology"
  | "compassDisclaimer"
  | "compassConversationRegion"
  | "compassConversationTitle"
  | "compassConversationLive"
  | "compassRoleYou"
  | "compassAssistantName"
  | "compassConversationStarting"
  | "compassConversationWaiting"
  | "compassRetryHint"
  | "compassContinueHint"
  | "compassEndConversation"
  | "compassRetryConversation"
  | "compassRestartConversation"
  | "compassOpeningPizza"
  | "compassOpeningFood"
  | "nutritionCompassTitle"
  | "nutritionCompassStatePending"
  | "nutritionCompassStateNoMatch"
  | "nutritionCompassStateCarveOut"
  | "nutritionCompassStateIdle"
  | "nutritionCompassPlotPending"
  | "nutritionCompassPlotNoMatch"
  | "nutritionCompassPlotCarveOut"
  | "nutritionCompassPlotIdle"
  | "nutritionCompassDensityUnavailable"
  | "nutritionCompassSummaryNoDensity"
  | "nutritionCompassSummary"
  | "nutritionCompassQuadrantLimit"
  | "nutritionCompassQuadrantModerate"
  | "nutritionCompassQuadrantMindful"
  | "nutritionCompassQuadrantOften"
  | "nutritionCompassLower"
  | "nutritionCompassHigher"
  | "nutritionCompassScoreAxis"
  | "nutritionCompassHigherDensity"
  | "shellWordmark"
  | "loopSending"
  | "loopSearching"
  | "loopPausedOffscreen"
  | "cameraPrivacyLabel"
  | "gatePrivacyClaim"
  | "stripRegion"
  | "stripCameraButton"
  | "stripCameraButtonLabel"
  | "contentRegion"
  | "verdictEncourage"
  | "verdictModerate"
  | "verdictMinimize"
  | "servingsKeepTheScore"
  | "estimatedDrivers"
  | "verdictOutOf100"
  | "chartDirection"
  | "chartLegendLabel"
  | "chartYourQuadrant"
  | "plateAverageEyebrow"
  | "plateAverageNote"
  | "logItAnyway"
  | "nothingInView"
  | "nothingInViewBody"
  | "notScored"
  | "noMatchLabel"
  | "sayOneOfThese"
  | "identityReviewLabel"
  | "identityReviewRead"
  | "identityReviewConfirm"
  | "identityReviewReject"
  | "packageDetectedTitle"
  | "packageDetectedBody"
  | "packageScanRegion"
  | "packageDisclosureNotNow"
  | "packageBarcodeLooking"
  | "packageBarcodeFound"
  | "packageBarcodeUse"
  | "packageBarcodeReject"
  | "packageBarcodeError"
  | "barcodeReviewMiss"
  | "packageConfirmed"
  | "packageScanAnother"
  | "micReadyOrType"
  | "voiceBarRegion"
  | "transcriptExpand"
  | "transcriptCollapse"
  | "attributionLine"
  | "whyScoreClose"
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
    switchToTyped: "Type instead",
    cameraDenied: "Camera access is off. You can still type your question below.",
    micDenied: "Microphone access is off. You can still type your question below.",
    cameraUnavailable: "The camera isn't working. You can still type your question below.",
    voiceErrorLine: "The mic isn't connecting right now. You can still type your question.",
    fallbackNotice: "Type your question about the food and I'll answer.",
    askPlaceholder: "Ask about this food…",
    askButton: "Ask",
    liveTypedHint: "You can type instead of talking.",
    visionEstimateBadge: "Estimate from photo",
    labelPhotoRegion: "Nutrition label photo",
    labelScoreFromPhoto: "Read the Nutrition Facts label",
    labelReadingPhoto: "Reading the label…",
    labelReadFailure: "Couldn't read the label — try the barcode or better light.",
    labelPhotoEstimateBadge: "Estimate from label photo",
    labelPhotoCheck: "Read from the label photo — check the numbers below.",
    labelServingUnknown: "Couldn't read the serving size",
    unknownFood: "This food",
    portionAssuming: "Set to {servings} servings — tap to change.",
    portionSizeAssumption: "A {size} is about {servings} servings — change it?",
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
    portionChipHalf: "Half that",
    portionChipAbout: "About right",
    portionChipDouble: "Double it",
    nutritionCalories: "Calories",
    nutritionSodium: "Sodium",
    nutritionCarbs: "Carbs",
    nutritionAddedSugars: "Added sugars",
    nutritionSaturatedFat: "Saturated fat",
    todaySoFar: "Today so far",
    todayTotalLine: "{total} of {limit} {unit} ({percent}%)",
    todayTotalIncomplete: "Some foods you logged don't have this number.",
    logThis: "Log this",
    loggedConfirmation: "Added to your meals",
    addToPlate: "Add to plate",
    plateTitle: "Your plate",
    plateItemScore: "Food Compass {score}",
    plateNoScore: "Not scored",
    plateAverage: "Plate average",
    plateIncomplete: "Some items don't have nutrition info.",
    plateRemove: "Remove {food}",
    plateDecrease: "Decrease servings for {food}",
    plateIncrease: "Increase servings for {food}",
    plateServings: "{count} serving(s)",
    plateNutritionTitle: "Plate nutrition",
    plateLog: "Log plate",
    plateScanButton: "Scan the plate",
    plateScanBusy: "Reading the plate…",
    plateScanFailed: "Could not read the plate. Try again.",
    plateScanUnavailable: "Plate scan needs the live camera key.",
    plateScanEmpty: "No separate foods found. Get the whole plate in view and try again.",
    plateSkipped: "Skipped: {items} (not scored)",
    platePortionBasis: "Photo estimate: {basis}",
    plateCarbRange: "about {low}\u2013{high} g carbs",
    plateCarbEstimateNote:
      "Carb numbers from a photo are rough. Never use them for insulin math; follow your care team's plan.",
    recentMealsTitle: "Recent meals",
    noMealsYet: "No meals logged yet.",
    foodNotThis: "Not this?",
    savedFoodsTitle: "Foods you've had before",
    favoritesTitle: "Favorites",
    foodRecentsTitle: "Recent",
    savedFoodRescore: "See {food} again",
    favoriteAdd: "Add {food} to favorites",
    favoriteRemove: "Remove {food} from favorites",
    favoriteAddShort: "Favorite",
    favoriteRemoveShort: "Favorited",
    weekInFoodTitle: "Week in Food",
    weekMealsLogged: "{count} meals in the last 7 days",
    weekAverageItemScore: "average score",
    weekBandMix: "How your foods scored",
    weekBest: "Best: {food} ({score})",
    weekRoom: "Room to improve: {food} ({score})",
    weekOpenFood: "Open Food Lens",
    postMealNudgeTitle: "Check your blood sugar",
    postMealNudgeBody: "About {hours} hours since your {food} — a good time to check your blood sugar.",
    postMealNudgeCta: "Log a reading",
    postMealNudgeDismiss: "Dismiss",
    scoreGlucosePattern: "After meals with a low-scoring food, your blood sugar ran about {delta} mg/dL higher than after your other meals. That's what your own logs show, not a diagnosis — worth mentioning to your care team.",
    foodHistoryLogged: "You logged this on {date}.",
    foodHistoryReading: "Your reading about 2 hours later was {value} mg/dL. That's from your own logs, not a diagnosis.",
    mealAteEarlier: "I ate this earlier",
    mealTimeReason: "We use this to match your meal with your blood-sugar reading.",
    mealThirtyMinutesAgo: "30 min ago",
    mealOneHourAgo: "1 h ago",
    mealTwoHoursAgo: "2 h ago",
    mealCustomTime: "Custom meal time",
    mealSaveTime: "Save",
    mealTimePastError: "Pick a time that isn't in the future.",
    mealDelete: "Delete",
    mealConfirmDelete: "Yes, delete",
    mealCancel: "Cancel",
    betterOptionHint: "Ask for a better option.",
    flagSodium: "{amount} mg sodium — {percent}% of your {limit} mg daily limit",
    flagSaturatedFat: "{amount} g saturated fat — {percent}% of your {limit} g daily limit",
    flagAddedSugars: "{amount} g added sugars — {percent}% of your {limit} g daily limit",
    flagCarbs: "{amount} g carbs — {percent}% of your {limit} g for the day",
    flagPotassiumGood: "{amount} mg potassium — good for blood pressure",
    flagFiberGood: "{amount} g fiber — good for your heart",
    flagPotassiumMed: "High in potassium — check with your care team first because you take {med}",
    flagSaltSubstituteMed: "This is a salt substitute — check with your care team first because you take {med}",
    flagMetforminAlcohol: "Alcohol with {med} can upset your stomach and affect your blood sugar — go easy and ask your care team",
    flagBpTrend: "Your recent readings are trending up — extra reason to go easy on salt this week",
    flagDayTotalSodium: "With today's other meals, this goes over your daily sodium limit.",
    flagDayTotalCarbs: "With today's other meals, this goes over your daily carb limit.",
    flagDayTotalAddedSugars: "With today's other meals, this goes over your daily added-sugar limit.",
    flagDayTotalSaturatedFat: "With today's other meals, this goes over your daily saturated-fat limit.",
    pantryButton: "Find recipes in my pantry",
    pantryScanning: "Reading your pantry…",
    pantryDetectedTitle: "In your pantry",
    pantryRecipesTitle: "Recipe ideas",
    pantryToBuyLabel: "To pick up",
    pantryShoppingTitle: "Shopping list",
    pantryWatchLabel: "Heads up",
    pantryUnavailable: "I can't see your pantry right now. Turn the camera on, point it at your open pantry or fridge, and tap Find recipes.",
    pantryNoFood: "I didn't see any food. Point the camera at your open pantry or fridge and try again.",
    pantryLocked: "Enter your access code to use the pantry.",
    compassScoreLabel: "Food Compass score",
    compassBandEncourage: "Encourage",
    compassBandModerate: "Moderate",
    compassBandMinimize: "Minimize",
    compassEstimateBadge: "Estimate from label",
    compassEstimateNote: "Scored from the Nutrition Facts label alone, so it can be off by about {mae} points and usually reads low — labels don't list vitamins or plant nutrients.",
    compassCalorieDensity: "Calorie density",
    compassDensityVeryLow: "Very low",
    compassDensityLow: "Low",
    compassDensityMedium: "Medium",
    compassDensityHigh: "High",
    compassDensityUnknown: "Serving weight unknown",
    compassBetterOptions: "Better options",
    compassAlreadyBest: "Already one of the best choices in its group.",
    compassNoCloseMatch: "Nothing similar scores higher.",
    compassRecipeLink: "Recipe ideas",
    compassCarveOutZeroCalorie: "Water is the best choice there is — no score needed.",
    compassCarveOutBelow5: "Almost no calories, so there's no score for it.",
    compassCarveOutAlcohol: "Alcohol doesn't get a score.",
    compassCarveOutInfant: "Baby food doesn't get a score.",
    compassCarveOutSpecialized: "Medical and special-diet foods don't get a score.",
    compassAmbiguous: "This food has two scores, {low} and {high} — treat it as a range.",
    compassPointAtFood: "Point at a food",
    compassScoring: "Scoring…",
    compassMissingDomains: "Not on the label: {domains}",
    compassWhyScore: "Why this score?",
    compassNotAssessable: "No data for: {domains}.",
    compassPartlyAssessable: "Partial data for: {domains}.",
    compassDomainD1: "Nutrient ratios",
    compassDomainD2: "Vitamins",
    compassDomainD3: "Minerals",
    compassDomainD4: "Food ingredients",
    compassDomainD5: "Additives",
    compassDomainD6: "Processing",
    compassDomainD7: "Types of fat",
    compassDomainD8: "Fiber and protein",
    compassDomainD9: "Plant nutrients",
    guidanceGeneral: "General nutrition advice — not based on your readings or health history.",
    guidancePersonalized: "Based on your recent readings and health history.",
    demoPizzaPreview: "Pizza in the camera view",
    demoCameraUnavailable: "Camera is off. Turn on camera access to talk about your food.",
    compassScoreDetails: "Show score details for {food}",
    compassIdentifiedFood: "this food",
    compassKcalPer100g: "{calories} kcal / 100 g",
    compassPageTitle: "Food Lens",
    compassPageDescription:
      "Point the camera at a food and start talking. Tell us the restaurant, toppings, crust, or size as you go.",
    compassIdleEnded: "Conversation ended. Restart below or point at a new food.",
    compassIdleStarting: "Starting a conversation about this food…",
    compassIdleAwaiting: "Point at a food to start talking.",
    compassCameraRegion: "Food camera",
    compassResultRegion: "Score for this food",
    compassSortLegend: "Sort better options by",
    compassSortScore: "Highest score first",
    compassSortDensity: "Lowest calorie density first",
    compassNoPublishedScore: "We don't have a score for that one. Try a simpler name.",
    compassOrderInterpretation: "Your order",
    compassWeHeard: "Your order",
    compassRestaurant: "Restaurant",
    compassFood: "Food",
    compassToppings: "Toppings",
    compassCrust: "Crust",
    compassSize: "Size",
    compassNotSpecified: "Not specified",
    compassClosestPublished: "Scored as",
    compassNotRepresented: "The score doesn't include: {details}.",
    compassChooseCloser: "Pick something closer",
    nutritionProtein: "Protein",
    nutritionFiber: "Fiber",
    nutritionPotassium: "Potassium",
    compassPer100g: "per 100 g",
    compassNoNutrientPanel: "We don't have the nutrition numbers for this food, just its score.",
    compassBetterOptionsSorted: "Better options · {sort}",
    compassSortedScore: "highest score first",
    compassSortedDensity: "lowest calorie density first",
    compassHowScoringWorks: "How scoring works",
    compassScoreSource: "Food Compass 2.0 (Tufts University, used with permission)",
    compassMethodology: "Read the research",
    compassDisclaimer: "AI helps identify the food. Not medical advice — check with your care team.",
    compassConversationRegion: "Conversation",
    compassConversationTitle: "Talk about this food",
    compassConversationLive: "Add details or ask a question out loud.",
    compassRoleYou: "You",
    compassAssistantName: "Food Lens",
    compassConversationStarting: "Starting a conversation about {food}…",
    compassConversationWaiting: "Point at a food to start.",
    compassRetryHint: "Tap “Try again” to reconnect.",
    compassContinueHint: "You can keep talking or say the details again.",
    compassEndConversation: "End conversation",
    compassRetryConversation: "Try again",
    compassRestartConversation: "Start again",
    compassOpeningPizza: "I see {food}. Where's it from, and what toppings, crust, or size?",
    compassOpeningFood: "I see {food}. It scores {score} out of 100. What do you want to know?",
    nutritionCompassTitle: "Score and calories",
    nutritionCompassStatePending: "Checking this food…",
    nutritionCompassStateNoMatch: "No match yet — tell us a bit more about the food.",
    nutritionCompassStateCarveOut: "This food doesn't get a score, so it's not on the chart.",
    nutritionCompassStateIdle: "Point the camera at a food.",
    nutritionCompassPlotPending: "Finding its place…",
    nutritionCompassPlotNoMatch: "No match yet",
    nutritionCompassPlotCarveOut: "No score",
    nutritionCompassPlotIdle: "Point at a food",
    nutritionCompassDensityUnavailable: "Calories per gram unknown",
    nutritionCompassSummaryNoDensity: "{food}: scores {score} out of 100 · calories per gram unknown.",
    nutritionCompassSummary:
      "{food}: scores {score} out of 100 · {density} calories per gram ({per100g} per 100 g) · {quadrant}.",
    nutritionCompassQuadrantLimit: "Limit",
    nutritionCompassQuadrantModerate: "Good, but rich",
    nutritionCompassQuadrantMindful: "Light, but not great",
    nutritionCompassQuadrantOften: "Choose often",
    nutritionCompassLower: "Lower",
    nutritionCompassHigher: "Higher",
    nutritionCompassScoreAxis: "Score →",
    nutritionCompassHigherDensity: "↑ More calories per gram",
    shellWordmark: "FOOD LENS",
    loopSending: "Reading the camera",
    loopSearching: "Looking for food…",
    loopPausedOffscreen: "Camera paused — nothing sent",
    cameraPrivacyLabel: "Camera & privacy",
    gatePrivacyClaim: "The camera sends pictures only while it's on your screen. Scroll past it and nothing is sent.",
    stripRegion: "Food Lens status",
    stripCameraButton: "Camera",
    stripCameraButtonLabel: "Back to the camera",
    contentRegion: "About this food",
    verdictEncourage: "One of the better choices you can make.",
    verdictModerate: "Middle of the pack — fine now and then.",
    verdictMinimize: "A lot of calories for the nutrition you get.",
    servingsKeepTheScore: "More servings change the nutrition below, not the score.",
    estimatedDrivers: "These drivers are our estimate. The score itself is the published number.",
    verdictOutOf100: "of 100",
    chartDirection: "Down and to the right is better — higher score, fewer calories.",
    chartLegendLabel: "What the colors mean",
    chartYourQuadrant: "Your food is here",
    plateAverageEyebrow: "Plate average · {count} items",
    plateAverageNote: "Average of the items below, weighted by calories.",
    logItAnyway: "Log it anyway",
    nothingInView: "Nothing in view yet",
    nothingInViewBody: "Point at a food — or pick one you've had before.",
    notScored: "Not scored",
    noMatchLabel: "No match",
    sayOneOfThese: "Say one of these instead",
    identityReviewLabel: "Confirm the food",
    identityReviewRead: "I think this is {food}.",
    identityReviewConfirm: "Yes, use this food",
    identityReviewReject: "No, scan again",
    packageDetectedTitle: "This looks packaged",
    packageDetectedBody: "I need the package front, barcode, or Nutrition Facts label before I can score it.",
    packageScanRegion: "Package scan",
    packageDisclosureNotNow: "Not now",
    packageBarcodeLooking: "Looking up barcode {barcode}…",
    packageBarcodeFound: "Barcode found: {food}",
    packageBarcodeUse: "Use this product",
    packageBarcodeReject: "Not this",
    packageBarcodeError: "That barcode lookup was interrupted or unavailable. Try it again.",
    barcodeReviewMiss: "That barcode was not in the product databases, so I will not score it.",
    packageConfirmed: "Confirmed package: {food}",
    packageScanAnother: "Scan another food",
    micReadyOrType: "Tap the mic, or type your question.",
    voiceBarRegion: "Voice",
    transcriptExpand: "Show the conversation",
    transcriptCollapse: "Hide the conversation",
    attributionLine: "Food Compass 2.0, Tufts University, used with permission · AI-assisted identification · not medical advice.",
    whyScoreClose: "Close",
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
    switchToTyped: "Escribir en vez de hablar",
    cameraDenied: "El acceso a la cámara está desactivado. Aún puedes escribir tu pregunta abajo.",
    micDenied: "El acceso al micrófono está desactivado. Aún puedes escribir tu pregunta abajo.",
    cameraUnavailable: "La cámara no está funcionando. Aún puedes escribir tu pregunta abajo.",
    voiceErrorLine: "El micrófono no se está conectando. Aún puedes escribir tu pregunta.",
    fallbackNotice: "Escribe tu pregunta sobre la comida y te respondo.",
    askPlaceholder: "Pregunta sobre esta comida…",
    askButton: "Preguntar",
    liveTypedHint: "También puedes escribir en vez de hablar.",
    visionEstimateBadge: "Estimado por la foto",
    labelPhotoRegion: "Foto de la etiqueta nutricional",
    labelScoreFromPhoto: "Leer la tabla nutricional",
    labelReadingPhoto: "Leyendo la etiqueta…",
    labelReadFailure: "No pude leer la etiqueta; prueba el código de barras o una mejor iluminación.",
    labelPhotoEstimateBadge: "Estimado desde la foto de la etiqueta",
    labelPhotoCheck: "Leído de la foto de la etiqueta; revisa los números abajo.",
    labelServingUnknown: "No se pudo leer el tamaño de la porción",
    unknownFood: "Esta comida",
    portionAssuming: "{servings} porción(es) — toca para cambiar.",
    portionSizeAssumption: "{size}: unas {servings} porciones — ¿lo cambias?",
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
    portionChipHalf: "La mitad",
    portionChipAbout: "Así está bien",
    portionChipDouble: "El doble",
    nutritionCalories: "Calorias",
    nutritionSodium: "Sodio",
    nutritionCarbs: "Carbohidratos",
    nutritionAddedSugars: "Azucares anadidos",
    nutritionSaturatedFat: "Grasas saturadas",
    todaySoFar: "Total de hoy",
    todayTotalLine: "{total} de {limit} {unit} ({percent}%)",
    todayTotalIncomplete: "A algunas comidas que registraste les falta este dato.",
    logThis: "Guardar",
    loggedConfirmation: "Agregado a tus comidas",
    addToPlate: "Añadir al plato",
    plateTitle: "Tu plato",
    plateItemScore: "Food Compass {score}",
    plateNoScore: "Sin puntaje",
    plateAverage: "Promedio del plato",
    plateIncomplete: "Algunos alimentos no tienen datos nutricionales.",
    plateRemove: "Quitar {food}",
    plateDecrease: "Disminuir porciones de {food}",
    plateIncrease: "Aumentar porciones de {food}",
    plateServings: "{count} porción(es)",
    plateNutritionTitle: "Nutrición del plato",
    plateLog: "Registrar plato",
    plateScanButton: "Escanear el plato",
    plateScanBusy: "Leyendo el plato…",
    plateScanFailed: "No se pudo leer el plato. Inténtalo de nuevo.",
    plateScanUnavailable: "El escaneo del plato necesita la clave de la cámara.",
    plateScanEmpty: "No se encontraron alimentos separados. Enfoca todo el plato e inténtalo de nuevo.",
    plateSkipped: "Omitido: {items} (sin puntaje)",
    platePortionBasis: "Estimado de la foto: {basis}",
    plateCarbRange: "unos {low}\u2013{high} g de carbohidratos",
    plateCarbEstimateNote:
      "Los carbohidratos calculados con una foto son aproximados. No los uses para calcular la insulina; sigue el plan de tu equipo de salud.",
    recentMealsTitle: "Comidas recientes",
    noMealsYet: "Aún no hay comidas guardadas.",
    foodNotThis: "¿No es esto?",
    savedFoodsTitle: "Comidas que ya comiste",
    favoritesTitle: "Favoritos",
    foodRecentsTitle: "Recientes",
    savedFoodRescore: "Ver {food} otra vez",
    favoriteAdd: "Agregar {food} a favoritos",
    favoriteRemove: "Quitar {food} de favoritos",
    favoriteAddShort: "Favorito",
    favoriteRemoveShort: "En favoritos",
    weekInFoodTitle: "Semana de Comidas",
    weekMealsLogged: "{count} comidas en los últimos 7 días",
    weekAverageItemScore: "puntaje promedio",
    weekBandMix: "Cómo salieron tus comidas",
    weekBest: "Mejor: {food} ({score})",
    weekRoom: "Para mejorar: {food} ({score})",
    weekOpenFood: "Abrir Lente de Comida",
    postMealNudgeTitle: "Revisa tu azúcar en sangre",
    postMealNudgeBody: "Han pasado unas {hours} horas desde {food}; es un buen momento para revisar tu azúcar en sangre.",
    postMealNudgeCta: "Registrar una lectura",
    postMealNudgeDismiss: "Descartar",
    scoreGlucosePattern: "Después de comidas con un alimento de puntaje bajo, tu azúcar en sangre salió unos {delta} mg/dL más alta que después de tus otras comidas. Es lo que muestran tus propios registros, no un diagnóstico — vale la pena comentarlo con tu equipo de salud.",
    foodHistoryLogged: "Registraste esto el {date}.",
    foodHistoryReading: "Tu lectura de unas 2 horas después fue {value} mg/dL. Viene de tus propios registros; no es un diagnóstico.",
    mealAteEarlier: "Comí esto más temprano",
    mealTimeReason: "Usamos la hora en que comiste para conectarla con tu lectura de azúcar en sangre.",
    mealThirtyMinutesAgo: "Hace 30 min",
    mealOneHourAgo: "Hace 1 h",
    mealTwoHoursAgo: "Hace 2 h",
    mealCustomTime: "Hora personalizada de la comida",
    mealSaveTime: "Guardar",
    mealTimePastError: "Elige una hora que no esté en el futuro.",
    mealDelete: "Eliminar",
    mealConfirmDelete: "Sí, eliminar",
    mealCancel: "Cancelar",
    betterOptionHint: "Pide una mejor opción.",
    flagSodium: "{amount} mg de sodio — {percent}% de tu límite diario de {limit} mg",
    flagSaturatedFat: "{amount} g de grasa saturada — {percent}% de tu límite diario de {limit} g",
    flagAddedSugars: "{amount} g de azúcares añadidos — {percent}% de tu límite diario de {limit} g",
    flagCarbs: "{amount} g de carbohidratos — {percent}% de tus {limit} g del día",
    flagPotassiumGood: "{amount} mg de potasio — bueno para la presión arterial",
    flagFiberGood: "{amount} g de fibra — bueno para tu corazón",
    flagPotassiumMed: "Alto en potasio — consulta primero con tu equipo de salud porque tomas {med}",
    flagSaltSubstituteMed: "Esto es un sustituto de sal — consulta primero con tu equipo de salud porque tomas {med}",
    flagMetforminAlcohol: "El alcohol con {med} puede molestar tu estómago y afectar tu azúcar — ve con calma y consulta a tu equipo de salud",
    flagBpTrend: "Tus lecturas recientes están subiendo — una razón más para cuidar la sal esta semana",
    flagDayTotalSodium: "Con las demás comidas de hoy, esto pasa tu límite diario de sodio.",
    flagDayTotalCarbs: "Con las demás comidas de hoy, esto pasa tu límite diario de carbohidratos.",
    flagDayTotalAddedSugars: "Con las demás comidas de hoy, esto pasa tu límite diario de azúcares añadidos.",
    flagDayTotalSaturatedFat: "Con las demás comidas de hoy, esto pasa tu límite diario de grasas saturadas.",
    pantryButton: "Buscar recetas en mi despensa",
    pantryScanning: "Leyendo tu despensa…",
    pantryDetectedTitle: "En tu despensa",
    pantryRecipesTitle: "Ideas de recetas",
    pantryToBuyLabel: "Para comprar",
    pantryShoppingTitle: "Lista de compras",
    pantryWatchLabel: "Ojo",
    pantryUnavailable: "Ahora no puedo ver tu despensa. Enciende la cámara, apúntala a tu despensa o refrigerador abierto y toca Buscar recetas.",
    pantryNoFood: "No vi ningún alimento. Apunta la cámara a tu despensa o refrigerador abierto e inténtalo de nuevo.",
    pantryLocked: "Ingresa tu código de acceso para usar la despensa.",
    compassScoreLabel: "Puntaje Food Compass",
    compassBandEncourage: "Recomendado",
    compassBandModerate: "Moderado",
    compassBandMinimize: "Limitar",
    compassEstimateBadge: "Estimado por la etiqueta",
    compassEstimateNote:
      "Calculado solo con la tabla nutricional, así que puede variar unos {mae} puntos y casi siempre queda bajo: la etiqueta no muestra vitaminas ni nutrientes de las plantas.",
    compassCalorieDensity: "Densidad calórica",
    compassDensityVeryLow: "Muy baja",
    compassDensityLow: "Baja",
    compassDensityMedium: "Media",
    compassDensityHigh: "Alta",
    compassDensityUnknown: "Peso de la porción desconocido",
    compassBetterOptions: "Mejores opciones",
    compassAlreadyBest: "Ya es una de las mejores opciones de su grupo.",
    compassNoCloseMatch: "Nada parecido tiene mejor puntaje.",
    compassRecipeLink: "Ideas de recetas",
    compassCarveOutZeroCalorie: "El agua es la mejor opción que existe — no lleva puntaje.",
    compassCarveOutBelow5: "Tiene muy pocas calorías, así que no lleva puntaje.",
    compassCarveOutAlcohol: "El alcohol no lleva puntaje.",
    compassCarveOutInfant: "Los alimentos para bebés no llevan puntaje.",
    compassCarveOutSpecialized: "Los alimentos médicos y de dieta especial no llevan puntaje.",
    compassAmbiguous: "Esta comida tiene dos puntajes, {low} y {high} — tómalo como un rango.",
    compassPointAtFood: "Apunta a una comida",
    compassScoring: "Calculando…",
    compassMissingDomains: "La etiqueta no muestra: {domains}",
    compassWhyScore: "¿Por qué este puntaje?",
    compassNotAssessable: "Faltan datos de: {domains}.",
    compassPartlyAssessable: "Faltan algunos datos de: {domains}.",
    compassDomainD1: "Proporciones de nutrientes",
    compassDomainD2: "Vitaminas",
    compassDomainD3: "Minerales",
    compassDomainD4: "Ingredientes de alimentos",
    compassDomainD5: "Aditivos",
    compassDomainD6: "Procesamiento",
    compassDomainD7: "Tipos de grasa",
    compassDomainD8: "Fibra y proteína",
    compassDomainD9: "Nutrientes de las plantas",
    guidanceGeneral: "Consejo general de nutrición — no usa tus lecturas ni tu historial de salud.",
    guidancePersonalized: "Se basa en tus lecturas recientes y en tu historial de salud.",
    demoPizzaPreview: "Una pizza en la vista de la cámara",
    demoCameraUnavailable: "La cámara está apagada. Permite el acceso a la cámara para hablar sobre tu comida.",
    compassScoreDetails: "Mostrar los detalles del puntaje de {food}",
    compassIdentifiedFood: "esta comida",
    compassKcalPer100g: "{calories} kcal / 100 g",
    compassPageTitle: "Lente de Comida",
    compassPageDescription:
      "Apunta la cámara a una comida y empieza a hablar. Dinos el restaurante, los ingredientes, la masa o el tamaño mientras hablas.",
    compassIdleEnded: "La conversación terminó. Empieza de nuevo abajo o apunta a otra comida.",
    compassIdleStarting: "Iniciando una conversación sobre este alimento…",
    compassIdleAwaiting: "Apunta a una comida para empezar a hablar.",
    compassCameraRegion: "Cámara de alimentos",
    compassResultRegion: "Puntaje de esta comida",
    compassSortLegend: "Ordenar las mejores opciones por",
    compassSortScore: "Mayor puntaje primero",
    compassSortDensity: "Menor densidad calórica primero",
    compassNoPublishedScore: "No tenemos puntaje para esa comida. Prueba con un nombre más sencillo.",
    compassOrderInterpretation: "Tu pedido",
    compassWeHeard: "Tu pedido",
    compassRestaurant: "Restaurante",
    compassFood: "Alimento",
    compassToppings: "Ingredientes",
    compassCrust: "Masa",
    compassSize: "Tamaño",
    compassNotSpecified: "No especificado",
    compassClosestPublished: "Puntuado como",
    compassNotRepresented: "El puntaje no incluye: {details}.",
    compassChooseCloser: "Elige algo más parecido",
    nutritionProtein: "Proteína",
    nutritionFiber: "Fibra",
    nutritionPotassium: "Potasio",
    compassPer100g: "por 100 g",
    compassNoNutrientPanel: "No tenemos los datos nutricionales de esta comida, solo su puntaje.",
    compassBetterOptionsSorted: "Mejores opciones · {sort}",
    compassSortedScore: "mayor puntaje primero",
    compassSortedDensity: "menor densidad calórica primero",
    compassHowScoringWorks: "Cómo funciona el puntaje",
    compassScoreSource: "Food Compass 2.0 (Universidad de Tufts, usado con permiso)",
    compassMethodology: "Lee la investigación",
    compassDisclaimer: "La IA ayuda a identificar la comida. No es consejo médico — consulta a tu equipo de salud.",
    compassConversationRegion: "Conversación",
    compassConversationTitle: "Habla de esta comida",
    compassConversationLive: "Agrega detalles o haz una pregunta en voz alta.",
    compassRoleYou: "Tú",
    compassAssistantName: "Lente de Comida",
    compassConversationStarting: "Iniciando una conversación sobre {food}…",
    compassConversationWaiting: "Apunta a una comida para empezar.",
    compassRetryHint: "Toca “Volver a intentarlo” para reconectar.",
    compassContinueHint: "Puedes seguir hablando o decir los detalles otra vez.",
    compassEndConversation: "Terminar conversación",
    compassRetryConversation: "Volver a intentarlo",
    compassRestartConversation: "Empezar de nuevo",
    compassOpeningPizza: "Veo {food}. ¿De dónde es, y qué ingredientes, masa o tamaño tiene?",
    compassOpeningFood: "Veo {food}. Obtiene {score} de 100. ¿Qué quieres saber?",
    nutritionCompassTitle: "Puntaje y calorías",
    nutritionCompassStatePending: "Revisando esta comida…",
    nutritionCompassStateNoMatch: "Aún no hay coincidencia — cuéntanos un poco más sobre la comida.",
    nutritionCompassStateCarveOut: "Esta comida no lleva puntaje, así que no aparece en la gráfica.",
    nutritionCompassStateIdle: "Apunta la cámara a una comida.",
    nutritionCompassPlotPending: "Buscando su posición…",
    nutritionCompassPlotNoMatch: "Aún no hay coincidencia",
    nutritionCompassPlotCarveOut: "Sin puntaje",
    nutritionCompassPlotIdle: "Apunta a una comida",
    nutritionCompassDensityUnavailable: "Calorías por gramo desconocidas",
    nutritionCompassSummaryNoDensity: "{food}: obtiene {score} de 100 · calorías por gramo desconocidas.",
    nutritionCompassSummary:
      "{food}: obtiene {score} de 100 · {density} calorías por gramo ({per100g} por 100 g) · {quadrant}.",
    nutritionCompassQuadrantLimit: "Limitar",
    nutritionCompassQuadrantModerate: "Bueno, pero calórico",
    nutritionCompassQuadrantMindful: "Ligero, pero no muy bueno",
    nutritionCompassQuadrantOften: "Elige con frecuencia",
    nutritionCompassLower: "Menor",
    nutritionCompassHigher: "Mayor",
    nutritionCompassScoreAxis: "Puntaje →",
    nutritionCompassHigherDensity: "↑ Más calorías por gramo",
    shellWordmark: "LENTE DE COMIDA",
    loopSending: "Leyendo la cámara",
    loopSearching: "Buscando comida…",
    loopPausedOffscreen: "Cámara en pausa — no se envía nada",
    cameraPrivacyLabel: "Cámara y privacidad",
    gatePrivacyClaim: "La cámara envía fotos solo mientras está en tu pantalla. Si la desplazas fuera de la vista, no se envía nada.",
    stripRegion: "Estado de Lente de Comida",
    stripCameraButton: "Cámara",
    stripCameraButtonLabel: "Volver a la cámara",
    contentRegion: "Sobre esta comida",
    verdictEncourage: "Una de las mejores opciones que puedes elegir.",
    verdictModerate: "En el promedio — está bien de vez en cuando.",
    verdictMinimize: "Muchas calorías para la nutrición que aporta.",
    servingsKeepTheScore: "Más porciones cambian la nutrición de abajo, no el puntaje.",
    estimatedDrivers: "Estos factores son nuestra estimación. El puntaje es el número publicado.",
    verdictOutOf100: "de 100",
    chartDirection: "Abajo y a la derecha es mejor — más puntaje, menos calorías.",
    chartLegendLabel: "Qué significan los colores",
    chartYourQuadrant: "Tu comida está aquí",
    plateAverageEyebrow: "Promedio del plato · {count} alimentos",
    plateAverageNote: "Promedio de los alimentos de abajo, ajustado por calorías.",
    logItAnyway: "Guardarlo igual",
    nothingInView: "Nada a la vista todavía",
    nothingInViewBody: "Apunta a una comida — o elige una que ya hayas comido.",
    notScored: "Sin puntaje",
    noMatchLabel: "Sin coincidencia",
    sayOneOfThese: "Di una de estas en su lugar",
    identityReviewLabel: "Confirma la comida",
    identityReviewRead: "Creo que esto es {food}.",
    identityReviewConfirm: "Sí, usar esta comida",
    identityReviewReject: "No, escanear de nuevo",
    packageDetectedTitle: "Parece un producto empacado",
    packageDetectedBody: "Necesito el frente del paquete, el código de barras o la etiqueta de información nutricional antes de darle un puntaje.",
    packageScanRegion: "Escaneo del paquete",
    packageDisclosureNotNow: "Ahora no",
    packageBarcodeLooking: "Buscando el código {barcode}…",
    packageBarcodeFound: "Código encontrado: {food}",
    packageBarcodeUse: "Usar este producto",
    packageBarcodeReject: "No es este",
    packageBarcodeError: "La búsqueda del código se interrumpió o no está disponible. Inténtalo de nuevo.",
    barcodeReviewMiss: "Ese código no apareció en las bases de productos, así que no le asignaré un puntaje.",
    packageConfirmed: "Paquete confirmado: {food}",
    packageScanAnother: "Escanear otra comida",
    micReadyOrType: "Toca el micrófono o escribe tu pregunta.",
    voiceBarRegion: "Voz",
    transcriptExpand: "Mostrar la conversación",
    transcriptCollapse: "Ocultar la conversación",
    attributionLine: "Food Compass 2.0, Universidad Tufts, usado con permiso · identificación asistida por IA · no es consejo médico.",
    whyScoreClose: "Cerrar",
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
  | "voicePausedForSafety"
  | "crisisLockNote"
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
    voicePausedForSafety: "Voice paused for your safety",
    crisisLockNote:
      "The mic and the keyboard stay locked until you tap continue. These numbers work without a connection.",
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
    voicePausedForSafety: "Voz pausada por tu seguridad",
    crisisLockNote:
      "El micrófono y el teclado quedan bloqueados hasta que toques continuar. Estos números funcionan sin conexión.",
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
