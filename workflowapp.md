● Here's the flow:              

  7-Phase Development Pipeline                                                                                                                                                                              
  Phase 1: Research    →  Phase 2: Plan    →  Phase 3: Foundation                                                                                                                                         
  (Scraper agent)         (Any agent)          (Build agent)      
                                                    ↓
  Phase 6: Deep Review ←  Phase 5: Polish  ←  Phase 4: Screens
  (Scraper agent)         (Build agent)        (Build agent)
                                                    ↓
                          Phase 7: Improve
                          (Build agent)

  For Multi-Agent (3 apps at same time):

  ┌────────────┬───────────┬───────────────────────────────────────────────┐
  │  Terminal  │   Agent   │                 What it does                  │
  ├────────────┼───────────┼───────────────────────────────────────────────┤
  │ Terminal 1 │ Scraper   │ Phase 1 research for App A, B, C (sequential) │
  ├────────────┼───────────┼───────────────────────────────────────────────┤
  │ Terminal 2 │ Builder A │ Phase 2→5 for App A                           │
  ├────────────┼───────────┼───────────────────────────────────────────────┤
  │ Terminal 3 │ Builder B │ Phase 2→5 for App B                           │
  ├────────────┼───────────┼───────────────────────────────────────────────┤
  │ Terminal 4 │ Builder C │ Phase 2→5 for App C                           │
  ├────────────┼───────────┼───────────────────────────────────────────────┤
  │ Terminal 1 │ Scraper   │ Phase 6 deep review for all 3                 │
  └────────────┴───────────┴───────────────────────────────────────────────┘

  How to Use

  1. Open WORKFLOW.md in Play_App_Store_Scraper/
  2. Copy the Phase 1 prompt
  3. Replace [YOUR KEYWORD] with your app idea
  4. Paste into the scraper agent
  5. Get research results
  6. Copy Phase 2 prompt, paste research results in, give to a builder agent
  7. Continue through phases

  Each prompt is self-contained — just fill in the [VARIABLES] and paste.