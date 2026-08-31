import type { Language } from "./strings";

export type PackageStringKey =
  | "packageScanRegion"
  | "packageScanAction"
  | "packageDisclosureTitle"
  | "packageDisclosureBody"
  | "packageDisclosureContinue"
  | "packageDisclosureNotNow"
  | "packageAuthorizing"
  | "packagePhotoFlow"
  | "packageFrontTitle"
  | "packageFrontAction"
  | "packageFrontReading"
  | "packageFrontRead"
  | "packageIdentityEdit"
  | "packageIdentityConfirm"
  | "packageRetake"
  | "packageNutritionTitle"
  | "packageNutritionAction"
  | "packageNutritionReading"
  | "packageNutritionReview"
  | "packageNutritionConfirm"
  | "packageServing"
  | "packageServingsPerContainer"
  | "packageBasisPerServing"
  | "packageIngredients"
  | "packageUnavailableValue"
  | "packageWarnings"
  | "packageOmitted"
  | "packageChooseFrontPhoto"
  | "packageChooseNutritionPhoto"
  | "packageBarcodeLooking"
  | "packageBarcodeFound"
  | "packageBarcodeUse"
  | "packageBarcodeReject"
  | "packageBarcodeMiss"
  | "packageBarcodeError"
  | "packageBarcodeConflictTitle"
  | "packageBarcodeConflictBody"
  | "packageConflictFrontIdentity"
  | "packageConflictBarcodeIdentity"
  | "packageConfirmed"
  | "packageScanAnother"
  | "packageRescanBody"
  | "packageRescanColumns"
  | "packageRescanServing"
  | "packageRescanRows"
  | "packageRescanSinglePackage"
  | "packageRescanNotPackage"
  | "retry";

const packageStrings: Record<Language, Record<PackageStringKey, string>> = {
  en: {
    packageScanRegion: "Package scan",
    packageScanAction: "Scan a package",
    packageDisclosureTitle: "Before you take a package photo",
    packageDisclosureBody: "The current package photo will be sent to OpenAI to read the label. This app does not save the photo. OpenAI's data controls and retention are separate.",
    packageDisclosureContinue: "Continue",
    packageDisclosureNotNow: "Not now",
    packageAuthorizing: "Opening secure package scan…",
    packagePhotoFlow: "Scan package photos",
    packageFrontTitle: "Show the front",
    packageFrontAction: "Read package front",
    packageFrontReading: "Reading the package front…",
    packageFrontRead: "I read: {food}",
    packageIdentityEdit: "Product name",
    packageIdentityConfirm: "Looks right",
    packageRetake: "Retake",
    packageNutritionTitle: "Turn to Nutrition Facts",
    packageNutritionAction: "Read Nutrition Facts",
    packageNutritionReading: "Reading Nutrition Facts…",
    packageNutritionReview: "Check every number before using it",
    packageNutritionConfirm: "Use these numbers",
    packageServing: "Serving: {serving}",
    packageServingsPerContainer: "Servings per container: {servings}",
    packageBasisPerServing: "Basis: per serving",
    packageIngredients: "Ingredients",
    packageUnavailableValue: "Unreadable",
    packageWarnings: "Review notes",
    packageOmitted: "Not readable or not printed: {fields}",
    packageChooseFrontPhoto: "Choose a package-front photo",
    packageChooseNutritionPhoto: "Choose a Nutrition Facts photo",
    packageBarcodeLooking: "Looking up barcode {barcode}…",
    packageBarcodeFound: "Barcode found: {food}",
    packageBarcodeUse: "Use this product",
    packageBarcodeReject: "Not this",
    packageBarcodeMiss: "That barcode was not in the product databases. Use the package front and Nutrition Facts instead.",
    packageBarcodeError: "That barcode lookup was interrupted or unavailable. Try it again.",
    packageBarcodeConflictTitle: "The barcode and package front disagree",
    packageBarcodeConflictBody: "Choose the barcode product or reject it. No score is shown while these identities conflict.",
    packageConflictFrontIdentity: "Package front: {food}",
    packageConflictBarcodeIdentity: "Barcode record: {food}",
    packageConfirmed: "Confirmed package: {food}",
    packageScanAnother: "Scan another food",
    packageRescanBody: "I could not read that reliably. Reduce glare, fill the frame, and keep one label in view.",
    packageRescanColumns: "Show the whole panel and use the per-serving column. If there are two columns, keep both visible so I do not guess.",
    packageRescanServing: "Include the serving size and the top of the Nutrition Facts panel.",
    packageRescanRows: "Keep calories, total fat, sodium, carbs, fiber, sugars, and protein readable in one photo.",
    packageRescanSinglePackage: "Put one package front in the frame and move other products away.",
    packageRescanNotPackage: "Show the printed front of one packaged food.",
    retry: "Try again"
  },
  es: {
    packageScanRegion: "Escaneo del paquete",
    packageScanAction: "Escanear un paquete",
    packageDisclosureTitle: "Antes de fotografiar el paquete",
    packageDisclosureBody: "La foto actual del paquete se enviará a OpenAI para leer la etiqueta. Esta aplicación no guarda la foto. Los controles y la retención de datos de OpenAI son independientes.",
    packageDisclosureContinue: "Continuar",
    packageDisclosureNotNow: "Ahora no",
    packageAuthorizing: "Abriendo el escaneo seguro…",
    packagePhotoFlow: "Escanear fotos del paquete",
    packageFrontTitle: "Muestra el frente",
    packageFrontAction: "Leer el frente del paquete",
    packageFrontReading: "Leyendo el frente del paquete…",
    packageFrontRead: "Leí: {food}",
    packageIdentityEdit: "Nombre del producto",
    packageIdentityConfirm: "Es correcto",
    packageRetake: "Tomar otra foto",
    packageNutritionTitle: "Gira a Información Nutricional",
    packageNutritionAction: "Leer Información Nutricional",
    packageNutritionReading: "Leyendo Información Nutricional…",
    packageNutritionReview: "Revisa cada número antes de usarlo",
    packageNutritionConfirm: "Usar estos números",
    packageServing: "Porción: {serving}",
    packageServingsPerContainer: "Porciones por envase: {servings}",
    packageBasisPerServing: "Base: por porción",
    packageIngredients: "Ingredientes",
    packageUnavailableValue: "No legible",
    packageWarnings: "Notas para revisar",
    packageOmitted: "No legible o no impreso: {fields}",
    packageChooseFrontPhoto: "Elegir una foto del frente del paquete",
    packageChooseNutritionPhoto: "Elegir una foto de Información Nutricional",
    packageBarcodeLooking: "Buscando el código {barcode}…",
    packageBarcodeFound: "Código encontrado: {food}",
    packageBarcodeUse: "Usar este producto",
    packageBarcodeReject: "No es este",
    packageBarcodeMiss: "Ese código no apareció en las bases de productos. Usa el frente y la Información Nutricional.",
    packageBarcodeError: "La búsqueda del código se interrumpió o no está disponible. Inténtalo de nuevo.",
    packageBarcodeConflictTitle: "El código y el frente no coinciden",
    packageBarcodeConflictBody: "Elige el producto del código o recházalo. No se muestra puntaje mientras haya conflicto.",
    packageConflictFrontIdentity: "Frente del envase: {food}",
    packageConflictBarcodeIdentity: "Registro del código: {food}",
    packageConfirmed: "Paquete confirmado: {food}",
    packageScanAnother: "Escanear otra comida",
    packageRescanBody: "No pude leerlo con seguridad. Reduce el reflejo, llena el encuadre y muestra una sola etiqueta.",
    packageRescanColumns: "Muestra todo el panel y usa la columna por porción. Si hay dos columnas, deja ambas visibles para que no tenga que adivinar.",
    packageRescanServing: "Incluye el tamaño de la porción y la parte superior del panel de información nutricional.",
    packageRescanRows: "Mantén legibles en una foto las calorías, grasa total, sodio, carbohidratos, fibra, azúcares y proteína.",
    packageRescanSinglePackage: "Pon el frente de un solo paquete en el encuadre y aparta los otros productos.",
    packageRescanNotPackage: "Muestra el frente impreso de un alimento envasado.",
    retry: "Inténtalo de nuevo"
  }
};

export function pt(language: Language, key: PackageStringKey, vars?: Record<string, string | number>): string {
  const template = packageStrings[language]?.[key] ?? packageStrings.en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}
