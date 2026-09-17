// Product facts shared by the visible page copy and structured data.
export const platformDescription =
  "Universident conectează pacienții adulți cu studenți la medicină dentară pentru tratamente realizate sub supervizare.";

export const publicAnswers = [
  { id: "ce-este-universident", question: "Ce este Universident?", answer: platformDescription },
  {
    id: "cine-realizeaza-tratamentele",
    question: "Cine realizează tratamentele?",
    answer: "Tratamentele sunt realizate de studenți la medicină dentară, sub supervizare. Pe profilul public al studentului poți vedea universitatea, anul de studiu și supervizorii asociați tratamentelor disponibile.",
  },
  {
    id: "cum-solicit-programare",
    question: "Cum solicit o programare?",
    answer: "Alegi tratamentul și orașul, consulți rezultatele și selectezi un interval disponibil. Pentru a trimite cererea ai nevoie de un cont de pacient cu adresa de email verificată și data nașterii completată.",
  },
  {
    id: "cine-se-poate-programa",
    question: "Cine se poate programa prin Universident?",
    answer: "Programările prin Universident sunt pentru pacienți care au împlinit 18 ani. Data nașterii se completează în profilul privat înainte de prima cerere de programare.",
  },
  {
    id: "confirmarea-programarii",
    question: "Cererea de programare este confirmată automat?",
    answer: "Nu. După trimitere, cererea așteaptă confirmarea studentului. Poți urmări starea ei în contul tău, la Programări.",
  },
] as const;

export function studentStudyDescription(university: string, studyYear: number) {
  return `Student la medicină dentară, anul ${studyYear} la ${university}.`;
}

export function studentSearchIntroduction(
  treatment?: { name: string },
  city?: { name: string },
  hasResults = false,
) {
  if (treatment && city && hasResults) {
    return `Pentru ${treatment.name.toLocaleLowerCase("ro-RO")} în ${city.name}, poți consulta mai jos studenții cu intervale disponibile pentru tratamente sub supervizare. Alegi o oră liberă și trimiți o cerere, pe care studentul trebuie să o confirme.`;
  }
  return "Alege tratamentul și orașul pentru a găsi studenți la medicină dentară cu ore disponibile. Tratamentele sunt realizate sub supervizare, iar cererea de programare trebuie confirmată de student.";
}
