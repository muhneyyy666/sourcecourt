export const CASE_FILE = {
  id: "SC-1854-01",
  eyebrow: "Public health · causal reasoning",
  title: "The Broad Street pump",
  subtitle: "Can one water pump explain the 1854 Soho cholera outbreak?",
  location: "Soho, London",
  period: "August–September 1854",
  readingTime: "7 min",
  learningGoal:
    "Build a causal claim that survives contradictory evidence without reaching beyond the record.",
  background:
    "In late August 1854, a severe local cholera outbreak struck Soho during a wider London epidemic. John Snow already argued that cholera could travel through water; here he combined death addresses, household interviews, exposure comparisons, and later engineering evidence. The pump handle was removed on 8 September, after cases had begun to fall. This record asks what the combined evidence can establish—and what the familiar hero story overstates.",
  starterClaim:
    "Water from the Broad Street pump was the sole cause of the 1854 Soho cholera outbreak.",
  facets: [
    { id: "spatial", label: "Spatial pattern" },
    { id: "exposure", label: "Exposure link" },
    { id: "comparison", label: "Natural comparison" },
    { id: "timeline", label: "Timeline" },
    { id: "mechanism", label: "Plausible mechanism" },
    { id: "counter", label: "Counterevidence" }
  ],
  sources: [
    {
      id: "S01",
      title: "Deaths clustered around the pump",
      kind: "Map & mortality record",
      author: "John Snow",
      date: "1855",
      stance: "supports",
      facets: ["spatial"],
      summary:
        "Snow plotted deaths near Golden Square and observed that mortality was densest around the public pump in Broad Street, while deaths generally diminished with distance.",
      excerpt:
        "A black mark or bar for each death is placed in the situation of the house.",
      limitation:
        "A cluster can reveal association, but distance alone does not prove which exposure caused illness.",
      url: "https://johnsnow.matrix.msu.edu/work.php/id=15-78-52/"
    },
    {
      id: "S02",
      title: "Families reported using Broad Street water",
      kind: "Household interviews",
      author: "John Snow",
      date: "1854–1855",
      stance: "supports",
      facets: ["exposure"],
      summary:
        "Snow and local collaborators asked affected households where they obtained drinking water. Many nearby victims were reported to have used the Broad Street pump.",
      excerpt:
        "I was informed that the deceased persons used to drink the pump water from Broad Street, either constantly or occasionally.",
      limitation:
        "Retrospective interviews can be incomplete and do not cover every death in the district.",
      url: "https://johnsnow.matrix.msu.edu/documentUploads/15-78-2CE/15-78-2CE-22-Doc19-JS-CholGolSq1854-09-23.pdf"
    },
    {
      id: "S03",
      title: "The handle was removed after the peak",
      kind: "Intervention chronology",
      author: "John Snow",
      date: "8 September 1854",
      stance: "complicates",
      facets: ["timeline", "counter"],
      summary:
        "Parish authorities removed the pump handle after Snow presented his findings. Snow also acknowledged that the outbreak had already begun to decline before the intervention.",
      excerpt:
        "The number of attacks of cholera had been diminished before this measure was adopted.",
      limitation:
        "The timing prevents the handle removal from serving as a clean before-and-after experiment.",
      url: "https://johnsnow.matrix.msu.edu/documentUploads/15-78-2CE/15-78-2CE-22-Doc19-JS-CholGolSq1854-09-23.pdf"
    },
    {
      id: "S04",
      title: "The workhouse had its own well",
      kind: "Natural comparison",
      author: "John Snow",
      date: "1855",
      stance: "supports",
      facets: ["comparison", "exposure"],
      summary:
        "More than five hundred people lived in the Poland Street workhouse, inside the affected area. Snow reported comparatively few cholera deaths and noted that residents used an internal well rather than the Broad Street pump.",
      excerpt:
        "The workhouse has a pump-well on the premises ... and the inmates never sent to Broad Street for water.",
      limitation:
        "Workhouse residents also differed from neighboring households in routines, supervision, and living conditions.",
      url: "https://johnsnow.matrix.msu.edu/documentUploads/15-78-2BD/15-78-2BD-22-Doc26-IV-RprtToCIC.pdf"
    },
    {
      id: "S05",
      title: "Brewery workers largely escaped",
      kind: "Natural comparison",
      author: "John Snow",
      date: "1855",
      stance: "supports",
      facets: ["comparison", "exposure"],
      summary:
        "Workers at a brewery near the pump were reported to drink malt liquor and water from the brewery’s own well. Snow found that the workforce experienced unusually few deaths.",
      excerpt:
        "The men are allowed a certain quantity of malt liquor, and Mr. Huggins believes they do not drink water at all.",
      limitation:
        "The report relies partly on the proprietor’s account and does not eliminate every workplace difference.",
      url: "https://johnsnow.matrix.msu.edu/documentUploads/15-78-2BD/15-78-2BD-22-Doc26-IV-RprtToCIC.pdf"
    },
    {
      id: "S06",
      title: "A distant resident still drank the water",
      kind: "Outlier investigation",
      author: "John Snow",
      date: "1855",
      stance: "supports",
      facets: ["exposure"],
      summary:
        "A widow living in Hampstead died of cholera despite living far from Soho. Her family told Snow that she preferred Broad Street water and had bottles delivered to her home.",
      excerpt:
        "The water was taken on Thursday, 31st August, and she drank of it in the evening, and also on Friday.",
      limitation:
        "A memorable individual case strengthens an exposure link but cannot establish a population-level cause by itself.",
      url: "https://www.gutenberg.org/files/72894/72894-h/72894-h.htm"
    },
    {
      id: "S07",
      title: "The central inquiry favored a diffused agent",
      kind: "Contemporary counterargument",
      author: "General Board of Health, Medical Council",
      date: "1855",
      stance: "complicates",
      facets: ["counter", "mechanism"],
      summary:
        "The central inquiry acknowledged that the well water was impure but considered the outbreak’s sudden rise and short duration more consistent with an atmospheric or other widely diffused agent.",
      excerpt:
        "All point to some atmospheric or other widely diffused agent still to be discovered.",
      limitation:
        "The investigation began after the peak and did not use household water-exposure data as fully as the local inquiries.",
      url: "https://wellcomecollection.org/works/ckquck57"
    },
    {
      id: "S08",
      title: "Whitehead independently tested the link",
      kind: "Independent local inquiry",
      author: "Henry Whitehead",
      date: "1854–1867",
      stance: "supports",
      facets: ["exposure", "mechanism"],
      summary:
        "Local curate Henry Whitehead initially doubted Snow, then repeatedly interviewed residents. His independent counts linked pump-water exposure with illness and traced a plausible contamination route near the well.",
      excerpt:
        "The statistics which I shall lay before the Committee are the result of personal inquiry.",
      limitation:
        "The interviews covered only part of the population and were conducted months later, so recall and selection bias remain possible.",
      url: "https://johnsnow.matrix.msu.edu/work.php/id=15-78-7D/"
    },
    {
      id: "S09",
      title: "Water-company comparison across London",
      kind: "Population comparison",
      author: "John Snow",
      date: "1855",
      stance: "supports",
      facets: ["comparison", "mechanism"],
      summary:
        "Beyond Soho, Snow compared households served by two water companies drawing from cleaner and more polluted stretches of the Thames. Cholera mortality differed sharply between the groups.",
      excerpt:
        "It is obvious that no experiment could have been devised which would more thoroughly test the effect of water supply on the progress of cholera…",
      limitation:
        "This strengthens the general waterborne theory but is not direct evidence about the Broad Street well itself.",
      url: "https://www.gutenberg.org/files/72894/72894-h/72894-h.htm"
    },
    {
      id: "S10",
      title: "The outbreak was already in decline",
      kind: "Retrospective chronology",
      author: "Henry Whitehead",
      date: "1867",
      stance: "complicates",
      facets: ["counter", "timeline"],
      summary:
        "Whitehead used daily fatal-attack counts to challenge the later story that removing the handle immediately ended the epidemic. He still considered the action capable of preventing renewed exposure.",
      excerpt:
        "The outbreak had already reached its climax, and had been steadily on the decline.",
      limitation:
        "The account was published years later; its claim about preventing a renewed outbreak remains a counterfactual inference.",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5523601/"
    }
  ]
};

export function publicCaseFile() {
  return structuredClone(CASE_FILE);
}

export function sourceById(id) {
  return CASE_FILE.sources.find((source) => source.id === id);
}
