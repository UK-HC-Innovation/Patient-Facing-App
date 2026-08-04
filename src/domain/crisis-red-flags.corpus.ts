import type { CrisisCorpusCase } from "./crisis-red-flags";

export const CRISIS_RECALL_FLOOR = 0.95;

export const crisisGateCorpus: CrisisCorpusCase[] = [
  {
    id: "vision_sudden_loss",
    text: "I suddenly cannot see out of one eye",
    expectedMatched: true,
    domain: "vision"
  },
  {
    id: "vision_curtain",
    text: "A curtain came over my vision this morning",
    expectedMatched: true,
    domain: "vision"
  },
  {
    id: "vision_flashes_floaters",
    text: "I have new flashes and a bunch of floaters",
    expectedMatched: true,
    domain: "vision"
  },
  {
    id: "vision_eye_pain",
    text: "My eye pain is severe today",
    expectedMatched: true,
    domain: "vision"
  },
  {
    id: "vision_losing_sight_plain",
    text: "I think I am losing my sight",
    expectedMatched: true,
    domain: "vision"
  },
  {
    id: "vision_curtain_eye_plain",
    text: "a curtain came over my eye",
    expectedMatched: true,
    domain: "vision"
  },
  {
    id: "vision_new_floaters_plain",
    text: "I suddenly have lots of new floaters",
    expectedMatched: true,
    domain: "vision"
  },
  {
    id: "vision_flashes_light_plain",
    text: "I keep seeing flashes of light",
    expectedMatched: true,
    domain: "vision"
  },
  {
    id: "vision_went_dark_plain",
    text: "everything went dark for a minute",
    expectedMatched: true,
    domain: "vision"
  },
  {
    id: "self_harm_sleep",
    text: "I do not want to wake up tomorrow",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "self_harm_direct",
    text: "I am thinking about killing myself",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "self_harm_not_here",
    text: "I don't want to be here anymore",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "self_harm_want_to_die",
    text: "I want to die",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "self_harm_overdose",
    text: "I took the whole bottle of my lisinopril on purpose",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_son_wants_to_die",
    text: "my son says he wants to die",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_demo_saying_wants_to_die",
    text: "honestly she's been saying she wants to die",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_daughter_hurting_herself",
    text: "my daughter has been hurting herself",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_told_kill_himself",
    text: "he told me he wants to kill himself",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_child_ran_away_missing",
    text: "my kid ran away from home and we can't find her",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_collapse_give_up",
    text: "I can't do this anymore, I want to give up",
    expectedMatched: true,
    domain: "caregiver_collapse"
  },
  {
    id: "caregiver_wants_end_his_life",
    text: "my son wants to end his life",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_threatens_hurt_herself",
    text: "my daughter threatens to hurt herself",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_keeps_cutting_himself",
    text: "my son keeps cutting himself",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_wandered_still_cannot_find",
    text: "my child wandered off and we still cannot find them",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_got_out_is_missing",
    text: "my child got out of the house and is missing",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_someone_hurting_child",
    text: "someone is hurting my child",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "caregiver_child_being_abused",
    text: "my daughter is being abused",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "caregiver_es_daughter_wants_to_die",
    text: "mi hija dice que quiere morir",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "direct_es_wants_to_die",
    text: "quiero morir",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "direct_es_wants_to_kill_self",
    text: "me quiero matar",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "direct_es_no_longer_wants_to_live",
    text: "ya no quiero vivir",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_son_no_longer_wants_to_live",
    text: "mi hijo dice que ya no quiere vivir",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_daughter_currently_cutting",
    text: "mi hija se está cortando",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_son_kill_himself",
    text: "mi hijo me dijo que quiere matarse",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_daughter_end_life",
    text: "mi hija ha dicho que quiere quitarse la vida",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_son_not_keep_living",
    text: "mi hijo no quiere seguir viviendo",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_threatens_self_injury",
    text: "mi hija amenaza con hacerse daño",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_ongoing_cutting",
    text: "mi hijo sigue cortándose",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_ongoing_self_injury",
    text: "mi hija ha estado haciéndose daño",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "direct_es_thinking_kill_self",
    text: "estoy pensando en matarme",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "direct_es_think_end_life",
    text: "pienso quitarme la vida",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "direct_es_going_kill_self",
    text: "me voy a matar",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "direct_es_going_suicide",
    text: "voy a suicidarme",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "direct_es_not_wake_tomorrow",
    text: "no quiero despertar mañana",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "direct_es_end_my_life",
    text: "quiero acabar con mi vida",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_son_thinks_kill_self",
    text: "mi hijo dice que piensa matarse",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_daughter_going_suicide",
    text: "mi hija me dijo que va a suicidarse",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_son_end_his_life",
    text: "mi hijo dijo que quiere acabar con su vida",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_nena_wants_to_die",
    text: "mi nena dice que quiere morir",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_son_thinks_self_harm",
    text: "mi hijo piensa en matarse",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_son_thinking_suicide",
    text: "mi hijo está pensando en suicidarse",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_daughter_threatens_suicide",
    text: "mi hija amenaza con suicidarse",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_daughter_attempted_end_life",
    text: "mi hija intentó quitarse la vida",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_nino_wants_to_die",
    text: "mi nino dice que quiere morir",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_denial_then_same_child_positive",
    text: "mi hija nunca dijo que quería morir, pero ahora dice que quiere morir",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_denial_then_other_child_positive",
    text: "mi hija no dice que quiere morir; mi hijo sí dice que quiere morir",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_cutting_denial_then_positive",
    text: "mi hija no se está cortando, pero mi hijo sí se está cortando",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_threat_denial_then_positive",
    text: "mi hija nunca amenazó con hacerse daño, pero hoy mi hijo amenaza con hacerse daño",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_eloped_missing",
    text: "mi hijo se escapó de casa y todavía no lo encontramos",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_lost_missing",
    text: "mi niña salió de la casa y sigue desaparecida",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_currently_missing",
    text: "mi hijo está desaparecido",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_cannot_find_then_elopement",
    text: "no encuentro a mi hijo; se escapó de casa",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_elopement_child_reverse_order",
    text: "se escapó de casa mi hijo y no lo encontramos",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_lost_not_appeared",
    text: "mi hija se perdió y todavía no aparece",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_left_not_returned",
    text: "mi hijo salió de casa y no ha vuelto",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_nena_eloped_missing",
    text: "mi nena se escapó de casa y no la encontramos",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_nina_unaccented_eloped_missing",
    text: "mi nina se escapo de casa y no la encontramos",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_abuse_disclosure",
    text: "alguien está lastimando a mi hija",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "caregiver_es_maltreatment_disclosure",
    text: "están abusando de mi hijo",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "caregiver_es_abuse_denial_then_positive",
    text: "no están abusando de mi hija, pero están abusando de mi hijo",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "caregiver_es_abused_denial_then_positive",
    text: "mi hija no está siendo abusada, pero mi hijo sí está siendo abusado",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "caregiver_es_collapse",
    text: "ya no puedo hacer esto, quiero rendirme",
    expectedMatched: true,
    domain: "caregiver_collapse"
  },
  {
    id: "caregiver_es_collapse_endurance",
    text: "no aguanto más con esto y me quiero rendir",
    expectedMatched: true,
    domain: "caregiver_collapse"
  },
  {
    id: "caregiver_es_collapse_short",
    text: "ya no puedo más, quiero rendirme",
    expectedMatched: true,
    domain: "caregiver_collapse"
  },
  {
    id: "acute_chest_pain",
    text: "I have crushing chest pain and cannot breathe",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "stroke_signs",
    text: "My face is drooping and my speech is slurred",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "acute_worst_headache",
    text: "worst headache of my life and my BP is 210 over 120",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "logistics_ride",
    text: "Can someone help me find a ride?",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "logistics_saturday",
    text: "I need a Saturday appointment",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "negation_would_never",
    text: "I would never hurt myself",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "negation_not_going_to",
    text: "I'm not going to hurt myself, I just feel down",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "figurative_diet",
    text: "this diet is killing me",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "figurative_pharmacy",
    text: "the pharmacy is killing me with these prices",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "logistics_eye_appointment",
    text: "I need a ride to my eye appointment",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "education_go_blind_question",
    text: "will I go blind from diabetes?",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "education_lose_vision_question",
    text: "will I lose my vision someday?",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "reading_after_stairs",
    text: "my blood pressure was 150 over 95 after climbing the stairs",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_accidental_recess_injury",
    text: "he hurt himself at recess yesterday",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_metaphorical_waitlist",
    text: "this waitlist is killing me",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_vegetable_frustration",
    text: "I give up trying to get her to eat vegetables",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_eager_horse_language",
    text: "she's dying to ride the horses",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_soccer_ball_movement",
    text: "he ran away with the soccer ball",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_life_insurance_policy",
    text: "my father wants to end his life insurance policy",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_life_support",
    text: "she wants to end her life support",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_missing_dog",
    text: "my dog ran away from home and we still cannot find her",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_missing_package",
    text: "my package got out of the house and is missing",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_negated_death",
    text: "mi hija no quiere morir; quiere vivir",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_not_reporting_death",
    text: "mi hija no dice que quiere morir",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_never_reported_death",
    text: "mi hija nunca ha dicho que quiere morir",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_not_currently_reporting_death",
    text: "mi hija no está diciendo que quiere morir",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_never_threatens_self_injury",
    text: "mi hija nunca amenaza con hacerse daño",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_not_currently_cutting",
    text: "mi hija no se está cortando",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_negated_abuse",
    text: "no están abusando de mi hijo",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_residence_lexington",
    text: "no quiero vivir en Lexington",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_child_residence_parent",
    text: "mi hija no quiere vivir con su padre",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_currently_cutting_hair",
    text: "mi hija se está cortando el pelo",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_cutting_hair_ends",
    text: "mi hija sigue cortándose las puntas",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_not_being_abused",
    text: "mi hija no está siendo abusada",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_nobody_abusing_child",
    text: "nadie está abusando de mi hijo",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_never_maltreated",
    text: "mi hijo nunca ha sido maltratado",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_was_not_maltreated",
    text: "mi hija no fue maltratada",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_abuse_claim_not_true",
    text: "no es cierto que alguien está lastimando a mi hija",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_evaluated_not_maltreated",
    text: "mi hijo fue evaluado, no maltratado",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_child_sad_missing_dog",
    text: "mi hijo está triste porque su perro se escapó de casa y todavía no lo encontramos",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_child_searches_missing_cat",
    text: "mi hija busca a su gato que se perdió y no lo encontramos",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_child_reports_dog_left",
    text: "mi hijo dijo que mi perro se fue de casa y aún no lo encuentro",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_child_reports_dog_lost",
    text: "mi hijo dijo que mi perro se perdió y no lo encuentro",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_child_returned_after_elopement",
    text: "mi hijo se escapó de casa y no lo encontramos al principio, pero ya volvió",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_never_wants_to_give_up",
    text: "no aguanto más con esto, pero jamás me quiero rendir",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_also_does_not_want_to_give_up",
    text: "ya no puedo hacer esto, pero tampoco quiero rendirme",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_does_not_want_to_be_defeated",
    text: "ya no puedo hacer esto, pero no quiero darme por vencida",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_no_way_wants_to_give_up",
    text: "no aguanto más con esto, pero de ninguna manera quiero rendirme",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_accidental_recess_injury",
    text: "se lastimó jugando al fútbol",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_waitlist_idiom",
    text: "esta lista de espera me está matando",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_eager_horse_idiom",
    text: "mi hija se muere por montar a caballo",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_embarrassment_idiom",
    text: "mi hija dice que quiere morirse de vergüenza",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_cutting_hair",
    text: "mi hijo sigue cortándose el pelo",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_vegetable_frustration",
    text: "me rindo tratando de que coma verduras",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_missing_dog",
    text: "mi perro se escapó de casa y todavía no lo encontramos",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_negated_collapse",
    text: "ya no puedo hacer esto, pero no quiero rendirme",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_negated_self_injury",
    text: "mi hijo nunca se haría daño",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_abusing_patience",
    text: "el programa está abusando de mi paciencia",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_life_insurance",
    text: "quiere cancelar su seguro de vida",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "caregiver_es_says_wants_kill_self_reflexive_order",
    text: "mi hijo dice que se quiere matar",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_says_going_suicide_reflexive_order",
    text: "mi hija dice que se va a suicidar",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_child_tried_kill_self",
    text: "mi niño trató de matarse",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_adolescent_attempted_cutting",
    text: "mi adolescente intentó cortarse",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_child_threatens_cutting",
    text: "mi niña amenaza con cortarse",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_child_wants_end_life",
    text: "mi hijo quiere terminar con su vida",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_child_currently_cutting_reflexive",
    text: "mi hijo está cortándose",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_child_currently_harming_self",
    text: "mi hija se está haciendo daño",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_child_cuts_arms",
    text: "mi hija se corta los brazos",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_child_has_cut_deliberately",
    text: "mi hijo se ha cortado a propósito",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_child_cut_yesterday_deliberately",
    text: "mi hija se cortó ayer a propósito",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_child_resumed_cutting",
    text: "mi niño volvió a cortarse",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_child_harms_self",
    text: "mi hija se hace daño",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_child_hurts_self_deliberately",
    text: "mi hijo se lastima a propósito",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_child_started_cutting",
    text: "mi nena empezó a cortarse",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_child_injured_self_deliberately",
    text: "mi hijo se hirió a propósito",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_child_burned_self_deliberately",
    text: "mi hija se quemó a propósito",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_adolescent_scratches_until_bleeding",
    text: "mi adolescente se rasguña hasta sangrar",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_past_cutting_now_stopped",
    text: "mi hija se estaba cortando, pero ya dejó de hacerlo",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_suicide_common_misspelling",
    text: "mi hija dice que quiere suisidarse",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_little_one_eloped_missing",
    text: "mi pequeño se escapó de casa y no lo encuentro",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_baby_lost_missing",
    text: "mi bebé se perdió y todavía no aparece",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_little_son_left_not_returned",
    text: "mi hijito salió de casa y no ha vuelto",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_daughter_fled_missing",
    text: "mi hija se fugó de casa y todavía no aparece",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_son_disappeared_not_found",
    text: "mi hijo desapareció y aún no lo encontramos",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_son_missing_for_hours",
    text: "mi hijo lleva horas desaparecido",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_daughter_location_unknown_overnight",
    text: "no sé dónde está mi hija desde anoche",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_twelve_year_old_left_not_returned",
    text: "mi hija de doce años salió y no regresó",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_abuse_nene",
    text: "están abusando de mi nene",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "caregiver_es_past_abuse",
    text: "abusaron de mi hija",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "caregiver_es_coach_hurting_child",
    text: "mi hijo dice que su entrenador lo está lastimando",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "caregiver_es_someone_hits_child",
    text: "mi hijo dice que alguien le pega",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "caregiver_es_caregiver_hit_child",
    text: "mi niña fue golpeada por su cuidador",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "caregiver_es_child_suffered_sexual_abuse",
    text: "mi hijo sufrió abuso sexual",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "caregiver_es_child_disclosed_inappropriate_touch",
    text: "mi hija me contó que la tocaron inapropiadamente",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "caregiver_es_minor_receiving_blows",
    text: "mi menor está recibiendo golpes en casa",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "caregiver_es_caregiver_mistreats_child",
    text: "el cuidador maltrata a mi hijo",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "caregiver_es_collapse_cannot_handle",
    text: "no puedo con esto, quiero rendirme",
    expectedMatched: true,
    domain: "caregiver_collapse"
  },
  {
    id: "caregiver_es_collapse_no_more_to_give",
    text: "ya no doy más, quiero rendirme",
    expectedMatched: true,
    domain: "caregiver_collapse"
  },
  {
    id: "caregiver_es_collapse_gives_up",
    text: "no puedo más, me rindo",
    expectedMatched: true,
    domain: "caregiver_collapse"
  },
  {
    id: "caregiver_es_collapse_going_to_give_up",
    text: "no aguanto más, voy a rendirme",
    expectedMatched: true,
    domain: "caregiver_collapse"
  },
  {
    id: "caregiver_es_collapse_abandon_everything",
    text: "quiero abandonar todo porque ya no puedo más",
    expectedMatched: true,
    domain: "caregiver_collapse"
  },
  {
    id: "trap_es_school_life",
    text: "mi hijo quiere acabar con su vida escolar",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_child_now_with_caregiver",
    text: "mi hija se escapó de casa y no la encontramos al principio; ahora está conmigo",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_missing_child_in_story",
    text: "mi niño se perdió y todavía no aparece en el cuento",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_elopement_in_movie",
    text: "en la película la nena se escapó de casa y no la encuentran",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_abuse_question_in_guide",
    text: "la guía pregunta si mi hija está siendo abusada",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_abuse_claim_denied_later",
    text: "dijeron que mi hijo fue abusado, pero no es cierto",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_abuse_form_error",
    text: "mi hija fue abusada según el formulario, pero esa respuesta fue un error",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_crossword_give_up",
    text: "no aguanto más este crucigrama y quiero rendirme",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_video_game_give_up",
    text: "ya no puedo hacer esto en el videojuego, quiero rendirme",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_diet_give_up",
    text: "no puedo seguir así con esta dieta, quiero rendirme",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "caregiver_es_child_self_made_cuts",
    text: "mi hija tiene cortes que se hizo ella misma",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_es_named_child_eloped_missing",
    text: "Mateo se escapó de casa y todavía no lo encontramos",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "caregiver_es_partner_hitting_child",
    text: "el novio de mi hija la está golpeando",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "caregiver_es_child_reports_abuse",
    text: "mi hija dice que la están abusando",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "trap_es_sedentary_life",
    text: "quiero quitarme la vida sedentaria",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_child_returned_an_hour_ago",
    text: "mi hijo salió de casa y no ha vuelto, pero volvió hace una hora",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_missing_child_hypothetical",
    text: "¿qué debo hacer si mi hijo se escapó de casa y no lo encontramos?",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_abuse_hypothetical",
    text: "¿cómo sé si mi hijo está siendo abusado?",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_abuse_belief_denial",
    text: "no creo que mi hija esté siendo abusada",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_task_give_up",
    text: "no aguanto más con esta tarea y quiero rendirme",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_bureaucracy_application_give_up",
    text: "no puedo más con la burocracia, quiero rendirme con la solicitud",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_game_level_give_up",
    text: "no aguanto más este nivel y me quiero rendir",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "self_harm_past_tense_reflexive_threat",
    text: "he threatened to hurt himself again last night",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "harm_to_others_animals_reported",
    text: "He has been harmful towards animals",
    expectedMatched: true,
    domain: "harm_to_others"
  },
  {
    id: "harm_to_others_hurt_the_cat",
    text: "my son hurt the cat again and I do not know what to do",
    expectedMatched: true,
    domain: "harm_to_others"
  },
  {
    id: "harm_to_others_classmate",
    text: "he has been hurting other kids at school",
    expectedMatched: true,
    domain: "harm_to_others"
  },
  {
    id: "harm_to_others_threat",
    text: "he threatened to hurt his teacher during the meltdown",
    expectedMatched: true,
    domain: "harm_to_others"
  },
  {
    id: "harm_to_others_weapon_at_school",
    text: "the school called because he brought a knife to school",
    expectedMatched: true,
    domain: "harm_to_others"
  },
  {
    id: "harm_to_others_es_animals",
    text: "mi hijo lastima a los animales cuando se enoja",
    expectedMatched: true,
    domain: "harm_to_others"
  },
  {
    id: "harm_to_others_es_classmate",
    text: "mi hijo golpea a otros niños en la escuela",
    expectedMatched: true,
    domain: "harm_to_others"
  },
  {
    id: "trap_rough_with_the_dog",
    text: "he is rough with the dog sometimes and we are working on it",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_chased_the_cat",
    text: "she chased the cat around the yard all afternoon",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_school_violence_discipline_record",
    text: "he has been kicked out of school several times for violence and acting out",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_never_hurt_the_dog",
    text: "he would never hurt the dog, he adores her",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_siblings_fight_over_toys",
    text: "they fight over toys every single afternoon",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_es_does_not_hit_classmates",
    text: "mi hijo no golpea a otros niños en la escuela",
    expectedMatched: false,
    domain: "logistics"
  },

  // ---------------------------------------------------------------------------
  // Adjudicated 2026-08-04 from the spec 17 workstream A adversarial report
  // (docs/qa/2026-08-04-crisis-adversarial-candidates.md). Every case below broke
  // the detector when it was generated. Two candidates from that report were
  // deliberately NOT added — "I don't want to be here at the clinic all
  // afternoon" and "this paperwork is endless, I want to end it all" — because
  // the ideation reading is not clearly dominated in a health app. They still
  // fire, and that is the accepted behavior rather than an asserted trap.
  // ---------------------------------------------------------------------------

  // Traps: this app's own low-vision and self-care vocabulary must not escalate.
  {
    id: "trap_cannot_see_meter_numbers",
    text: "I can't see the numbers on my glucose meter",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_cannot_see_pill_label",
    text: "I can't see the label on the pill bottle without my glasses",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_cannot_see_where_to_tap",
    text: "I can't see where to tap to log my reading",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_cannot_see_appointment_time",
    text: "I cannot see my appointment time anywhere in the app",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_no_eye_pain_today",
    text: "No eye pain today, the drops are working",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_mild_eye_pain_allergies",
    text: "Mild eye pain from my allergies this week",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_eye_pain_resolved",
    text: "The eye pain I had last month is completely gone",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_meter_flashing_light",
    text: "There is a flashing light on my glucose meter, what does it mean?",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_power_outage_went_dark",
    text: "Everything went dark when the power went out during the storm",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_fear_of_going_blind",
    text: "I am scared of going blind someday, is that likely with diabetes?",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_die_of_embarrassment",
    text: "I want to die of embarrassment, I called the nurse by the wrong name",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_hurt_myself_exercising",
    text: "I don't want to hurt myself doing the new exercises, how do I start slow?",
    expectedMatched: false,
    domain: "logistics"
  },
  {
    id: "trap_hurt_myself_lifting",
    text: "I might hurt myself lifting the wheelchair into the trunk",
    expectedMatched: false,
    domain: "logistics"
  },

  // English self-harm phrasings the Spanish rules already caught.
  {
    id: "self_harm_no_point_living",
    text: "I don't see the point in living anymore",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "self_harm_better_off_without_me",
    text: "Everyone would be better off without me",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "self_harm_wish_i_was_dead",
    text: "I wish I was dead",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "self_harm_dont_want_to_live",
    text: "I don't want to live anymore",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "self_harm_thinking_about_ending_things",
    text: "I have been thinking about ending things",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_son_wishes_he_was_dead",
    text: "My son told me he wishes he was dead",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_daughter_doesnt_want_to_live",
    text: "My daughter says she doesn't want to live anymore",
    expectedMatched: true,
    domain: "self_harm"
  },
  {
    id: "caregiver_child_talking_about_being_dead",
    text: "My son keeps talking about wanting to be dead",
    expectedMatched: true,
    domain: "self_harm"
  },

  // English caregiver collapse — the old rule needed one literal phrase.
  {
    id: "caregiver_collapse_nothing_left",
    text: "I have nothing left, I want to give up",
    expectedMatched: true,
    domain: "caregiver_collapse"
  },
  {
    id: "caregiver_collapse_cant_keep_going",
    text: "I can't keep going like this, I want to give up on everything",
    expectedMatched: true,
    domain: "caregiver_collapse"
  },
  {
    id: "caregiver_collapse_cant_take_it",
    text: "I can't take it anymore and I want to give up",
    expectedMatched: true,
    domain: "caregiver_collapse"
  },

  // English abuse by a named caregiver — Spanish already had coach/teacher rules.
  {
    id: "abuse_coach_hit_daughter",
    text: "My daughter's coach hit her at practice",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "abuse_teacher_touched_son",
    text: "My son told me his teacher touched him inappropriately",
    expectedMatched: true,
    domain: "abuse"
  },
  {
    id: "abuse_stepdad_hits_child",
    text: "My kid's stepdad hits him when I'm at work",
    expectedMatched: true,
    domain: "abuse"
  },

  // English currently-missing child with no elopement verb.
  {
    id: "acute_daughter_missing_since_last_night",
    text: "My daughter has been missing since last night",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "acute_dont_know_where_son_is",
    text: "I don't know where my son is and he has been gone since this morning",
    expectedMatched: true,
    domain: "acute_danger"
  },

  // Acute medical presentations that previously reached no rule at any tier.
  {
    id: "acute_unresponsive_severe_hypoglycemia",
    text: "My husband is unresponsive and his sugar is 32",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "acute_cannot_wake_mother_low_sugar",
    text: "I can't wake my mother up and her blood sugar was 28",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "acute_seizure_now",
    text: "She is having a seizure right now",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "acute_throat_closing_anaphylaxis",
    text: "Her throat is closing up after the new insulin",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "acute_chest_pain_radiating_arm",
    text: "I have crushing chest pain radiating down my left arm",
    expectedMatched: true,
    domain: "acute_danger"
  },
  {
    id: "acute_passed_out_unresponsive",
    text: "He passed out and I can't get him to respond",
    expectedMatched: true,
    domain: "acute_danger"
  },

  // Harm to others without the word "threaten", and infant-directed hitting.
  {
    id: "harm_to_others_said_hed_stab_brother",
    text: "He said he'd stab his brother",
    expectedMatched: true,
    domain: "harm_to_others"
  },
  {
    id: "harm_to_others_hit_the_baby",
    text: "He hit the baby in the face",
    expectedMatched: true,
    domain: "harm_to_others"
  }
];
