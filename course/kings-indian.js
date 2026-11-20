// The King's Indian Defence course: Black's repertoire against 1.d4, 1.c4,
// 1.Nf3 and the other first moves seen in ham_sandmitch's games.
//
// Each line is PGN movetext:
//   {text}          explains the move just played. "#tag" words at the start
//                   link it to a principle (course/principles.js).
//   (alt {text})    a variation right after a Black move: an alternative to
//                   that move, with why the repertoire move is preferred. A
//                   variation may continue with a few moves to show the idea.
// Notes are stored per position, so a comment written once applies to every
// line that reaches the same position (move orders and transpositions).
//
// Every repertoire move is checked by scripts/build-course.mjs: it must be
// legal, and Stockfish must not rate it much worse than the best move.
// Chapters are ordered by how often ham_sandmitch meets each system.

export const COURSE = {
  id: 'kid',
  name: "King's Indian Defence",
  side: 'b',
  intro:
    'Your Black repertoire against 1.d4 and everything else: the same set-up (...Nf6, ...g6, ...Bg7, ...O-O, ...d6) and two pawn breaks, ...e5 and ...c5. ' +
    'Against 1.d4 it always starts 1...Nf6 (1...d5 leads to Queen’s Gambit structures instead; against 1.e4, 1...d6 is the Pirc, the King’s Indian’s cousin). ' +
    'Most of your opponents never play the main-line King’s Indian, so the course starts with the systems you actually meet.',
  chapters: [
    {
      id: 'london',
      name: 'London System',
      white: '1.d4 and an early Bf4',
      games: 50,
      plan: {
        structure: 'White: d4, e3, c3 with bishops on f4 and d3 (or e2). You: g6-d6, then ...c5.',
        ideas: [
          'Hit d4 with ...c5. After ...cxd4 exd4 the e-file is half-open: ...Re8 and ...e5 follow.',
          '...Qb6 eyes b2: the bishop has left c1, so b2 is often defended only by the queen.',
          '...Nh5 chases the f4 bishop. Winning the bishop pair leaves your g7 bishop without a rival.',
          'Don’t drift: ...h6, ...a6 and ...b6 let White finish developing and squeeze you.',
        ],
        yourGames: 'Your most common London. Your first mistake came at a median of move 12, often around ...Bg4 and the h3 question, or after a slow kingside pawn move.',
      },
      lines: [
        {
          id: 'lon-castle',
          name: '5.Bd3 and 6.O-O: ...c5 and ...e5',
          pgn: `1.d4 Nf6 {#develop A knight toward the centre that stops e2-e4 for now. The King's Indian starts like this against almost everything.}
            (1...d5 {#centre Not the King's Indian. 1...d5 fixes your d-pawn on d5, so you get a Queen's Gambit or London-type game, and the King's Indian plan (...d6, ...e5 and the g7 bishop against d4) never happens. Against 1.d4 the King's Indian starts 1...Nf6. Your instinct fits 1.e4: 1.e4 d6 is the Pirc, the King's Indian's cousin.})
            (1...d6 {#e5push Playable and it often transposes, but it lets White play 2.e4 with a big centre: a Pirc, not a King's Indian. 1...Nf6 stops e2-e4 for now.})
            2.Bf4 {The London System: the bishop comes out before e3 shuts it in.}
            g6 {#centre Preparing ...Bg7. You let White keep the centre for now and aim a bishop at it.}
            3.Nf3 {White's usual plan: Nf3, e3, Bd3 or Be2, castle, then c3 and h3.}
            Bg7 {#bishop On the long diagonal the bishop guards your king and x-rays d4 and b2.}
            4.e3 {Supports d4 and lets the light-squared bishop out.}
            d6 {#e5push Takes control of e5 and prepares both breaks, ...e5 and ...c5. Castling first is just as good.}
            5.Bd3 {Club players usually put the bishop here, aiming at h7 behind your g6 pawn.}
            O-O {#develop King safe, rook connected. Now the fight for the centre can start.}
            6.O-O {White castles and waits.}
            c5 {#quiet Hit d4 from the side. This is the main plan against the London: attack the base of White's centre before White is fully set up.}
            (6...Bg4 {Playable, but after h3 you have to choose between giving up the bishop pair with ...Bxf3 or retreating. In your games this bishop often ended up passive on d7. ...c5 keeps the initiative.})
            (6...h6 {#shield A waiting move. It loosens g6 and does nothing for the centre.})
            7.c3 {Supports d4, so ...cxd4 can be met by exd4 or cxd4.}
            Nc6 {#develop The knight joins the pressure on d4.}
            8.h3 {Stops ...Bg4 and gives the f4 bishop a retreat on h2.}
            cxd4 {#open Opening the c-file and, after exd4, the e-file. Your g7 bishop's diagonal gets longer.}
            9.exd4 {Recapturing toward the centre. Now the e-file matters.}
            Re8 {#breaks The rook stands on the half-open e-file and supports ...e5.}
            (9...Qb6 {Also good, hitting b2 and d4. ...Re8 is simpler because it prepares the break.})
            10.Re1 {White also contests the e-file.}
            e5 {#breaks The break arrives. Your pieces are active and the game is equal: exactly what you want from the opening.}`,
          plan: {
            q: 'You have just played ...e5. If White trades with dxe5 dxe5, what should you aim for?',
            options: [
              'Active pieces in the open centre: rooks on the d- and e-files, a knight heading for d4, the g7 bishop on an open diagonal',
              'Push ...h6 and ...g5 to attack the bishop',
              'Trade queens and offer a draw',
            ],
            answer: 0,
            why: 'Open centre: pieces and files. After the pawn trade your pieces are as active as White’s, and the d4 square is a natural home for a knight.',
          },
        },
        {
          id: 'lon-c3',
          name: '6.c3: the same ...c5 plan',
          pgn: `1.d4 Nf6 2.Bf4 g6 3.Nf3 Bg7 4.e3 d6 5.Bd3 O-O
            6.c3 {A different move order: c3 before castling.}
            c5 {#quiet Same plan: hit d4. Move orders change, your plan doesn't.}
            (6...Nc6 {Fine too, but ...c5 keeps the c-pawn free and works against every London set-up.})
            7.O-O Nc6 8.h3 cxd4 9.exd4 Re8 {#breaks The same position as the 6.O-O line: ...e5 is next.}`,
          plan: {
            q: 'This position also arises after 6.O-O c5 7.c3. What does that tell you?',
            options: [
              'One plan (...c5, ...Nc6, ...cxd4, ...Re8, ...e5) covers most London move orders',
              'You need a different set-up for every White move order',
              'The position is lost',
            ],
            answer: 0,
            why: 'Learning plans instead of move lists: the same structure keeps coming back, so the same ideas work.',
          },
        },
        {
          id: 'lon-nbd2',
          name: '6.Nbd2: ...c5, ...cxd4 and an early ...e5',
          pgn: `1.d4 Nf6 2.Bf4 g6 3.Nf3 Bg7 4.e3 d6 5.Bd3 O-O
            6.Nbd2 {The knight supports e4. It doesn't cover d4, so ...c5 is even stronger.}
            c5 {#quiet Hit d4 before White gets c3 and e4 in.}
            7.c3 Nc6 8.O-O
            cxd4 {#open Opening the e-file first.}
            9.exd4
            e5 {#breaks With the e-file open, the ...e5 break comes at once and asks the f4 bishop where it's going.}
            10.Bg3 {The bishop steps back and keeps an eye on e5.}
            Nh5 {#chase Now the bishop is hunted on g3: ...Nxg3 would win the bishop pair.}
            11.dxe5 dxe5 {#open The centre opens and Black is slightly better (Stockfish about +0.3).}`,
          plan: {
            q: 'Your knight on h5 attacks the bishop on g3. What is the point?',
            options: [
              'Win the bishop pair with ...Nxg3, so your g7 bishop has no rival on the dark squares',
              'Prepare ...Qxh2 mate',
              'Defend the e5 pawn',
            ],
            answer: 0,
            why: 'Hunt White’s active bishop. Trading your knight for the London bishop leaves your g7 bishop as the strongest minor piece on the board.',
          },
        },
        {
          id: 'lon-be2',
          name: '5.Be2 and 6.h3: ...c5 and ...Qb6',
          pgn: `1.d4 Nf6 2.Bf4 g6 3.e3 Bg7 4.Nf3 d6 {#develop The same position as after 3.Nf3 Bg7 4.e3: move orders often transpose.}
            5.Be2 {A modest square, the masters' choice. The bishop doesn't aim at h7, but it can't be hit by ...e5-e4 either.}
            O-O 6.h3 {The most common master move: a retreat square for the bishop on h2 and no ...Bg4.}
            c5 {#quiet The main reply in master games: hit d4.}
            7.c3
            cxd4 {#open Trade first, so the queen can come to b6 with pressure on d4 and b2.}
            (7...Nc6 {Natural, but Stockfish prefers trading on d4 first, so that ...Qb6 hits two targets.})
            8.exd4
            Qb6 {#quiet The queen hits b2 and d4. With the bishop gone from c1, only White's queen defends b2.}
            9.Qb3 {Offering a queen trade to cover b2.}
            Nc6 {#develop Develop and keep the tension. If Qxb6 axb6, your rook gets the half-open a-file.}`,
          plan: {
            q: 'Why does ...Qb6 work so well against the London?',
            options: [
              'The bishop left c1, so b2 has few defenders, and the queen also hits d4',
              'It prepares ...Qxh2',
              'It stops White from castling',
            ],
            answer: 0,
            why: 'Against quiet systems, find the targets: in the London they are d4 and b2.',
          },
        },
        {
          id: 'lon-dxc5',
          name: '7.dxc5: recapture and hunt the bishop',
          pgn: `1.d4 Nf6 2.Bf4 g6 3.Nf3 Bg7 4.e3 d6 5.Bd3 O-O 6.O-O c5
            7.dxc5 {White takes the pawn, but it can't be kept.}
            dxc5 {#open Recapture. The d-file opens and your queen faces White's.}
            8.Nc3 Nc6 9.Qe2
            Nh5 {#chase The f4 bishop is the target. ...Nxf4 next would give you the bishop pair and the dark squares.}`,
          plan: {
            q: 'After ...Nh5, what is your idea?',
            options: ['...Nxf4, winning the bishop pair', '...Qxd3, winning a piece', '...f5 and ...f4, trapping the queen'],
            answer: 0,
            why: 'Hunt the active bishop. Black is already slightly better (Stockfish about +0.3).',
          },
        },
      ],
    },
    {
      id: 'colle',
      name: 'Colle and e3 systems',
      white: '1.d4, Nf3, e3 and Bd3, without Bf4',
      games: 51,
      plan: {
        structure: 'White: d4-e3 (often c3 or b3), bishop on d3 or e2. You: g6-d6, then ...e5.',
        ideas: [
          'No White bishop watches e5, so ...e5 is easy: prepare it with ...Nbd7 or ...Nc6.',
          'If White pushes e3-e4, the centre often opens: take on d4 when it helps your pieces and use the e-file.',
          'Against b3 and Bb2, ...e5 also blocks the long diagonal toward your king.',
          'Don’t drift: you scored only 37% against these set-ups, often after slow moves like ...b6, ...h6 or ...Qd7.',
        ],
        yourGames: 'Your lowest-scoring group of systems (37%). The first mistakes came early (a median of move 9 against 1.e3 set-ups).',
      },
      lines: [
        {
          id: 'col-nbd2',
          name: '6.Nbd2 and 7.e4: ...Nbd7 and ...e5',
          pgn: `1.d4 Nf6 2.Nf3 g6 {#centre The same set-up as against the London.}
            3.e3 {The Colle: a quiet pawn on e3 and the bishop to d3.}
            Bg7 4.Bd3 O-O {#develop Castle quickly. Nothing is happening yet.}
            5.O-O d6
            6.Nbd2 {Preparing e3-e4.}
            Nbd7 {#breaks The knight supports ...e5. On d7 it also keeps the c-pawn free.}
            (6...h6 {#shield This kind of waiting move led to many of your problems in Colle games. Prepare ...e5 instead.})
            (6...b6 {#quiet Slow. The bishop on b7 bites on d5 and e4 while White grabs the centre.})
            7.e4 {White builds the big centre.}
            e5 {#breaks The classic King's Indian answer: meet e4 with ...e5.}
            8.dxe5 dxe5 {#open The centre is symmetrical and level. Your knight can reach c5, attacking the d3 bishop and e4.}
            9.Qe2 Re8 {#open The rook supports e5 and the knight on d7 can now move.}`,
          plan: {
            q: 'After 8.dxe5 dxe5, where does your d7 knight want to go?',
            options: ['c5, hitting the d3 bishop and the e4 pawn', 'b8, back home', 'h5, then f4'],
            answer: 0,
            why: 'Open centre: pieces and squares. ...Nc5 is a classic King’s Indian route once the d-file has opened.',
          },
        },
        {
          id: 'col-c3',
          name: '6.c3: ...Nbd7, ...e5 and ...c5',
          pgn: `1.d4 Nf6 2.Nf3 g6 3.e3 Bg7 4.Bd3 O-O 5.O-O d6
            6.c3 {The classic Colle: c3, Nbd2 and e4.}
            Nbd7 7.Nbd2
            e5 {#breaks Strike first, before White plays e4.}
            8.e4
            exd4 {#open Release the tension so your rooks and the g7 bishop get open lines.}
            9.cxd4
            c5 {#breaks Now hit the new d4 pawn. If d5, the knight comes to e5 and your pieces are very active.}`,
          plan: {
            q: 'White has pawns on d4 and e4. What does ...c5 do?',
            options: [
              'Attacks d4 again; if White pushes d5 your knight gets the e5 square',
              'Prepares ...b5 and a queenside pawn storm',
              'Nothing: it is a waiting move',
            ],
            answer: 0,
            why: 'Pawn breaks are your counterplay. Every break in this line targets White’s d4 pawn.',
          },
        },
        {
          id: 'col-b3',
          name: '6.b3: ...Nc6 and ...e5',
          pgn: `1.d4 Nf6 2.Nf3 g6 3.e3 Bg7 4.Bd3 O-O 5.O-O d6
            6.b3 {The Colle-Zukertort: the bishop goes to b2, aiming down the long diagonal.}
            Nc6 {#breaks The knight supports ...e5 and pressures d4.}
            7.Bb2
            e5 {#bishop Block the b2 bishop's diagonal and hit d4.}
            8.dxe5
            Nd7 {#cct Not ...dxe5?, which leaves your knight on c6 loose to tactics on the d-file and long diagonal. The knight on d7 regains the pawn.}
            9.Nc3 Ncxe5 10.Nxe5 Nxe5 {#open Pawn regained, the long diagonal reopened for your bishop, and the game is level.}`,
          plan: {
            q: 'Why did you play ...e5 against the b2 bishop?',
            options: [
              'To blunt the bishop’s long diagonal toward g7 and your king, and to hit d4',
              'To open the f-file',
              'To win a pawn by force',
            ],
            answer: 0,
            why: 'The g7 and b2 bishops face each other; a pawn on e5 shields your side of the diagonal.',
          },
        },
        {
          id: 'col-c4',
          name: '2.e3 and 6.c4: ...Nbd7 and ...e5',
          pgn: `1.d4 Nf6 2.e3 g6 3.Nf3 Bg7 4.Be2 O-O 5.O-O d6
            6.c4 {White grabs some space on the queenside.}
            Nbd7 {#breaks Prepares ...e5 and keeps the c-pawn free.}
            7.Nc3 e5 {#breaks The break. Against a pawn on e3 (not e4), ...e5 gives Black an easy game.}`,
          plan: {
            q: 'White’s pawn is on e3, not e4. What does that mean after ...e5?',
            options: [
              'White has less space, so your pieces have more room. You can also play ...e4 later to gain space',
              'You must play ...exd4 at once',
              'White is threatening mate',
            ],
            answer: 0,
            why: 'Against quiet systems, take your share of the centre with the break.',
          },
        },
        {
          id: 'stonewall',
          name: 'Stonewall (Bd3 and f4): ...c5',
          pgn: `1.d4 Nf6 2.e3 g6
            3.Bd3 {Heading for the Stonewall with f4.}
            Bg7 4.f4 {The Stonewall: control of e5 and a kingside attack later.}
            d6 5.Nf3 O-O 6.O-O
            c5 {#quiet White's pawns on d4 and f4 leave e4 and the queenside soft. Hit d4.}
            7.c3 Nc6 {#develop Black is comfortable (Stockfish about +0.3).}`,
          plan: {
            q: 'With pawns on d4, e3 and f4, which square has White weakened?',
            options: ['e4: no White pawn can control it any more', 'h7', 'b8'],
            answer: 0,
            why: 'Every pawn move leaves squares behind. Your pieces can aim at e4 (...Bf5, ...Ne4 later).',
          },
        },
      ],
    },
    {
      id: 'jobava',
      name: 'Jobava, Barry and e4 attacks',
      white: '1.d4 with Nc3 and Bf4, Be3 or Qd2, often e4',
      games: 33,
      plan: {
        structure: 'White: Nc3 and a quick e4, often with Qd2, Bh6 and long castling. You: ...d6 in time, then ...c5, ...e5 or ...c6 and ...b5.',
        ideas: [
          'Put ...d6 in before White can play e4-e5 to kick your f6 knight.',
          'If e4-e5 does come with a bishop on f4, ...Nh5! hits the bishop and the e5 pawn often falls.',
          'Against Qd2 and Bh6, strike in the centre with ...e5 or ...c5. Against h4, answer ...h5.',
          'Careful with queen trades: after dxe5 dxe5 Qxd8, Nd5 hits c7. You lost twice to Nd5 and Nxc7 mate in this line.',
        ],
        yourGames: 'The earliest mistakes of any system: 57% of these games had a mistake by move 10 (median move 9).',
      },
      lines: [
        {
          id: 'job-e5',
          name: '4.e4 d6 5.e5: ...Nh5! and the e5 pawn falls',
          pgn: `1.d4 Nf6 2.Nc3 {The Jobava London (Nc3 and Bf4) or the Barry Attack.}
            g6 3.Bf4 Bg7
            4.e4 {White grabs the centre at once.}
            d6 {#e5push Now e4-e5 can be met by capturing on e5, or by ...Nh5.}
            5.e5 {Kicking the knight. This is the critical moment.}
            Nh5 {#chase Hitting the f4 bishop. After the bishop moves, the e5 pawn is attacked three times.}
            (5...dxe5 {You played this three times. After 6.dxe5 Qxd1+ 7.Rxd1 Nh5 8.Nd5! the queen trade leaves c7 weak, and twice 8...Nxf4?? lost to 9.Nxc7+ Kf8 10.Rd8 mate.})
            (5...Nfd7 {Playable, but passive. ...Nh5 hits the bishop and wins time.})
            6.Be3 {The bishop steps back but leaves e5 short of defenders.}
            dxe5 {#cct Now the capture works: White's queen trade no longer comes with a hit on c7.}
            7.dxe5 Qxd1+ 8.Rxd1
            Bxe5 {#cct A clean extra pawn. Stockfish rates Black about a pawn better.}`,
          plan: {
            q: 'Why does ...dxe5 work after 6.Be3 but not straight after 5.e5?',
            options: [
              'With ...Nh5 played first, the bishop has been driven off f4, so e5 can be won without Nd5 tricks against c7',
              'It never works',
              'Because White castled',
            ],
            answer: 0,
            why: 'Checks, captures, threats: the order of moves decides whether a capture wins a pawn or walks into a trap.',
          },
        },
        {
          id: 'job-e5-bd2',
          name: '5.e5 Nh5 6.Bd2: take on e5',
          pgn: `1.d4 Nf6 2.Nc3 g6 3.Bf4 Bg7 4.e4 d6 5.e5 Nh5
            6.Bd2 {Keeping the bishop on the c1-h6 diagonal.}
            dxe5 {#cct Take: the e5 pawn has lost its bishop support.}
            7.dxe5 Bxe5 {#cct A pawn up. Note that White can't trade queens with check this time.}
            8.Nf3 Bg7 {#bishop Back to the long diagonal. Black is clearly better (Stockfish about +0.5).}`,
          plan: {
            q: 'What principle won you the e5 pawn in this line?',
            options: [
              'Hunt the active bishop: ...Nh5 drove away e5’s defender, so the pawn fell',
              'Castle early',
              'Push the h-pawn',
            ],
            answer: 0,
            why: 'Hunt White’s active bishop: the f4 bishop was the only piece holding e5.',
          },
        },
        {
          id: 'job-qd2',
          name: '4.e4 d6 5.Qd2: ...c6 and ...e5 against Bh6',
          pgn: `1.d4 Nf6 2.Nc3 g6 3.Bf4 Bg7 4.e4 d6
            5.Qd2 {The attacking set-up: Bh6 to trade your bishop, long castling, then h4-h5.}
            c6 {#attack The masters' favourite. It covers d5 and b5 and prepares ...b5 or ...Qa5 toward White's king.}
            (5...O-O {Natural, but after Bh6 and h4 your king is the target. ...c6 keeps your options open.})
            6.Bh6 {Offering to trade your best defender.}
            Bxh6 {#bishop Taking is fine here, because the trade pulls White's queen to h6, where it doesn't help the centre.}
            7.Qxh6
            e5 {#attack Strike the centre while White's queen is far away.}
            8.O-O-O Qe7 {#develop Your king can castle long or stay in the centre; White's queen on h6 has no partner.}`,
          plan: {
            q: 'White has castled long with the queen on h6. What is your plan?',
            options: [
              'Counterattack: ...b5 or ...Qa5 on the queenside, plus pressure on d4 and e4',
              'Castle short at once',
              'Push ...h5 and ...g5',
            ],
            answer: 0,
            why: 'When White attacks your king, hit back in the centre and toward White’s king.',
          },
        },
        {
          id: 'job-e3',
          name: '4.e3: ...c5 against the d4 pawn',
          pgn: `1.d4 Nf6 2.Nc3 g6 3.Bf4 Bg7
            4.e3 {A London with Nc3 instead of c3.}
            O-O {#develop Castle: without e4 there is no rush for ...d6.}
            5.Nf3 d6 6.h3
            c5 {#quiet With the knight on c3, White can't support d4 with c3. Hit it.}
            7.Be2 cxd4 8.exd4 Nc6 {#open Pressure on d4 and a level game.}`,
          plan: {
            q: 'Why is ...c5 strong when White’s knight is on c3?',
            options: [
              'White can’t answer with c3, so d4 is harder to defend',
              'It traps the knight',
              'It prepares ...c4',
            ],
            answer: 0,
            why: 'Find the target: the knight on c3 blocks the c-pawn that would normally defend d4.',
          },
        },
        {
          id: 'job-nf3',
          name: '2.Nf3 and 4.Bf4: castle, then ...c5',
          pgn: `1.d4 Nf6 2.Nf3 g6 3.Nc3 Bg7 4.Bf4
            O-O {#develop Castling first is safer than ...d6 here: ...d6 allows a quick e4 with tempo ideas.}
            5.e3 d6 6.Be2 c5 7.O-O cxd4 8.exd4 Nc6 {#open The same idea again: pressure on d4.}`,
          plan: {
            q: 'This is the third line where you play ...c5, ...cxd4 and ...Nc6. Why does it keep working?',
            options: [
              'White’s set-up leaves d4 short of pawn support, and the g7 bishop adds pressure on it',
              'It is a trap',
              'It only works against strong players',
            ],
            answer: 0,
            why: 'One plan, many move orders: d4 is the target.',
          },
        },
        {
          id: 'job-150',
          name: '3.e4 d6! and the 150 Attack (Be3, Qd2)',
          pgn: `1.d4 Nf6 2.Nc3 g6
            3.e4 {White builds the centre and threatens e5.}
            d6 {#e5push First ...d6, so e4-e5 can be met by ...dxe5.}
            (3...Bg7 {#e5push You played this three times. White never pushed, but 4.e5 would have kicked your knight and gained time. Play ...d6 first.})
            4.Be3 {The 150 Attack: Be3, Qd2, Bh6 and long castling.}
            Bg7 5.Qd2
            c6 {#attack Flexible: ...b5 and ...Qa5 can come quickly against a king on c1.}
            6.Bh6 Bxh6 7.Qxh6
            e5 {#attack The same position as in the Jobava line with 5.Qd2: strike the centre while White's queen is offside on h6.}
            8.O-O-O Qe7 {#develop Your queen covers the kingside and eyes the queenside; ...b5 or ...Nbd7 next.}`,
          plan: {
            q: 'Why ...d6 on move 3 instead of ...Bg7?',
            options: [
              'So that e4-e5 can be answered by ...dxe5 instead of moving the f6 knight again',
              'To open the c8 bishop',
              'Because ...Bg7 is illegal',
            ],
            answer: 0,
            why: 'Don’t let e4-e5 kick your knight.',
          },
        },
        {
          id: 'pirc-nf3',
          name: '3.e4 d6 4.Nf3: ...c6, ...Nbd7 and ...e5',
          pgn: `1.d4 Nf6 2.Nc3 g6 3.e4 d6
            4.Nf3 {The calm Classical set-up.}
            Bg7 5.Be2 O-O 6.O-O
            c6 {#develop Covers d5 and b5 and prepares ...Nbd7 and ...e5.}
            7.a4 {Stops ...b5.}
            Nbd7 8.h3 e5 {#breaks The break, and a solid King's Indian structure.}`,
          plan: {
            q: 'Which break are you preparing with ...c6 and ...Nbd7?',
            options: ['...e5', '...f5', '...h5'],
            answer: 0,
            why: 'Pawn breaks are your counterplay: ...Nbd7 supports ...e5.',
          },
        },
        {
          id: 'pirc-f4',
          name: '3.e4 d6 4.f4: the Austrian, ...c5',
          pgn: `1.d4 Nf6 2.Nc3 g6 3.e4 d6
            4.f4 {The most aggressive set-up: three pawns in the centre.}
            Bg7 5.Nf3 O-O 6.Bd3
            Na6 {#develop Heading for c7 or b4, and supporting ...c5.}
            7.O-O c5 {#breaks Hit the big centre from the side. Strike the centre before it rolls over you.}`,
          plan: {
            q: 'White has pawns on d4, e4 and f4. How do you fight them?',
            options: ['Undermine them with ...c5 (and later ...e5 or ...e6)', 'Wait and see', 'Attack on the kingside with ...h5'],
            answer: 0,
            why: 'Let White take the centre, then hit it.',
          },
        },
      ],
    },
    {
      id: 'mainline',
      name: "King's Indian main lines",
      white: '1.d4, 2.c4, 3.Nc3 and 4.e4',
      games: 27,
      plan: {
        structure: 'White: the big centre with c4, d4 and e4. You: ...d6 and ...e5. When White plays d5, the centre locks.',
        ideas: [
          'Meet the big centre with ...e5 (or ...c5 against f3, f4 or Bg5 set-ups).',
          'If White plays d5, attack on the kingside: the knight moves (…Ne8, …Nd7, …Nh5), then ...f5, ...f4, ...g5.',
          'If White trades with dxe5 dxe5 Qxd8, the d4 square and the d-file matter. Watch Nd5 and Bg5 tricks.',
          'White attacks on the queenside (b4, c5). Your attack has to be faster.',
        ],
        yourGames: 'You meet the true main lines only now and then (27 games, mostly the Classical with Nf3 and Be2).',
      },
      lines: [
        {
          id: 'cls-mdp',
          name: 'Classical: 7.O-O Nc6 8.d5 Ne7, ...f5 and ...f4',
          pgn: `1.d4 Nf6 2.c4 {The main line: White takes space on the queenside.}
            g6 3.Nc3 Bg7 4.e4 {The big centre.}
            d6 {#e5push Stops e4-e5 and prepares ...e5.}
            5.Nf3 O-O 6.Be2 {The Classical Variation.}
            e5 {#breaks The main break: challenge d4 at once.}
            7.O-O Nc6 {#breaks More pressure on d4. White has to decide.}
            8.d5 {White locks the centre.}
            Ne7 {#closed The knight heads for the kingside, where your pawns point.}
            9.Ne1 {Freeing f3 for the pawn and heading for d3 to support c5.}
            Nd7 {#closed Clearing the f-pawn's path: ...f5 is next.}
            10.Nd3 f5 {#closed The kingside attack starts.}
            11.Bd2 Nf6 12.f3
            f4 {#closed Gaining space on the kingside: ...g5-g4 comes next. White will push c5 on the other wing.}`,
          plan: {
            q: 'The centre is locked. Where do you attack?',
            options: [
              'The kingside with ...g5-g4, toward White’s king (where your pawns point)',
              'The queenside with ...b5',
              'In the centre with ...c6',
            ],
            answer: 0,
            why: 'Closed centre: attack where your pawns point. Your d6-e5-f4 chain points at White’s kingside.',
          },
        },
        {
          id: 'cls-bayonet',
          name: 'Classical: 9.b4 (Bayonet), ...Nh5 and ...f5',
          pgn: `1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.O-O Nc6 8.d5 Ne7
            9.b4 {The Bayonet Attack: White starts on the queenside at once.}
            Nh5 {#closed The knight clears the f-pawn and eyes f4.}
            10.Re1 f5 {#closed Same plan, same speed. Both sides race on their own wing.}`,
          plan: {
            q: 'White is pushing on the queenside with b4. What is your answer?',
            options: ['Race on the kingside with ...f5, ...f4 and ...g5', 'Defend the queenside with ...b6 and ...a6', 'Offer queen trades'],
            answer: 0,
            why: 'Closed centre: attack where your pawns point, and make your attack faster than White’s.',
          },
        },
        {
          id: 'cls-exchange',
          name: 'Exchange: 7.dxe5 dxe5 8.Qxd8',
          pgn: `1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5
            7.dxe5 {The Exchange Variation, very common at club level.}
            dxe5 {#open Recapture with the pawn so it keeps control of d4 and f4.}
            8.Qxd8 Rxd8 {#open Queens are off. Your king is safe; now the d4 square and the d-file matter.}
            9.Bg5 {Pinning the f6 knight, with Nd5 ideas.}
            Re8 {#cct Unpinning in advance and protecting e7 against Nd5 tricks.}
            (9...Rf8 {Also fine. Both moves step out of the Nd5 tricks.})
            10.Nd5 Nxd5 11.cxd5 c6 {#open Hit the d5 pawn at once.}
            12.Bc4 cxd5 13.Bxd5 Nd7 {#open Level: Black's knight heads for c5 or f6 and the bishop pair isn't White's any more.}`,
          plan: {
            q: 'With queens off, what decides this kind of position?',
            options: [
              'Piece activity and key squares such as d4 and d5',
              'A direct attack on the king',
              'Who has more pawns on the kingside',
            ],
            answer: 0,
            why: 'Open centre: pieces and files.',
          },
        },
        {
          id: 'cls-d5',
          name: 'Classical: 7.d5 (Petrosian), ...a5 and ...Na6',
          pgn: `1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5
            7.d5 {Locking the centre at once.}
            a5 {#closed Stops b4 before White's queenside attack starts, and gives your knight c5 via a6.}
            8.Bg5 h6 {Asking the bishop: here the pawn move has a purpose (it gains time against the pin).}
            9.Bh4 Na6 {#closed Heading for c5. Later ...Qe8 and ...Nh7 can unpin, followed by ...f5.}`,
          plan: {
            q: 'Why ...a5 here?',
            options: [
              'To stop White’s b4 and secure c5 for your knight',
              'To attack on the queenside',
              'To trap the h4 bishop',
            ],
            answer: 0,
            why: 'In closed centres, slow your opponent’s pawn storm and give your pieces good squares.',
          },
        },
        {
          id: 'cls-be3',
          name: 'Classical: 7.Be3 (Gligoric), ...Ng4',
          pgn: `1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5
            7.Be3 {The Gligoric: the bishop defends d4.}
            Ng4 {#chase Hit the bishop at once. It has to leave e3.}
            8.Bg5 f6 {Kicking it again. Normally ...f6 isn't welcome, but here it gains time with a threat.}
            9.Bh4 Nc6 {#breaks Pressure on d4. Black is fine.}`,
          plan: {
            q: 'What was the idea of ...Ng4?',
            options: ['Hunt White’s dark-squared bishop and gain time', 'Attack h2', 'Prepare ...Nxe3 to trade knights'],
            answer: 0,
            why: 'Hunt White’s active bishop.',
          },
        },
        {
          id: 'cls-oo-be3',
          name: 'Classical: 7.O-O Nc6 8.Be3, ...Ng4 and ...f5',
          pgn: `1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.O-O Nc6
            8.Be3 {Defending d4 with the bishop.}
            Ng4 {#chase The same trick: chase the e3 bishop.}
            9.Bg5 f6 10.Bc1
            f5 {#breaks With the bishop back on c1, the f-pawn goes two squares and hits e4.}`,
          plan: {
            q: 'Why ...f5 now?',
            options: [
              'It hits e4, the base of White’s centre, while the bishop is back on c1',
              'To give your king air',
              'To trap White’s queen',
            ],
            answer: 0,
            why: 'Pawn breaks are your counterplay: ...f5 is the King’s Indian’s third break.',
          },
        },
        {
          id: 'samisch',
          name: 'Sämisch (5.f3): ...e5, ...Nh5 and ...f5',
          pgn: `1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6
            5.f3 {The Sämisch: rock-solid e4, then Be3, Qd2 and often long castling.}
            O-O 6.Be3 e5 {#breaks The central break. Your king is safe, so strike.}
            7.d5 Nh5 {#closed Making room for ...f5 and eyeing f4.}
            8.Qd2 f5 {#closed Hit e4.}
            9.O-O-O Nd7 {#develop Development first. Black has good counterplay against e4.}`,
          plan: {
            q: 'White has castled long. Which of your breaks is most useful?',
            options: ['...f5 (and later ...c6 or ...b5 toward White’s king)', '...h6', '...a6 and ...Ra7'],
            answer: 0,
            why: 'When White attacks, hit back in the centre and toward White’s king.',
          },
        },
        {
          id: 'four-pawns',
          name: 'Four Pawns (5.f4): ...c5 and ...e6',
          pgn: `1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6
            5.f4 {The Four Pawns Attack: a huge centre.}
            O-O 6.Nf3 c5 {#breaks Hit the centre from the side: big centres are targets.}
            7.d5 e6 {#breaks Undermine d5 too.}
            8.Be2 exd5 9.cxd5 Re8 {#open The rook hits e4. Black's pieces target the centre pawns.}`,
          plan: {
            q: 'What is the problem with White’s four centre pawns?',
            options: [
              'They are hard to support, and every pawn break opens lines for your pieces',
              'Nothing: they win automatically',
              'They block White’s king',
            ],
            answer: 0,
            why: 'Let White take the centre, then hit it.',
          },
        },
        {
          id: 'averbakh',
          name: 'Averbakh (5.Be2, 6.Bg5): ...c5',
          pgn: `1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6
            5.Be2 O-O 6.Bg5 {The Averbakh: the bishop discourages ...e5.}
            c5 {#breaks If ...e5 is awkward, the other break is ...c5.}
            7.d5 h6 {Asking the bishop with a purpose.}
            8.Be3 e6 {#breaks Hit d5 again. Black has good piece play.}`,
          plan: {
            q: 'Why ...c5 instead of ...e5 here?',
            options: [
              'The g5 bishop pins the knight and makes ...e5 hard; ...c5 hits d4 instead',
              'Because ...c5 attacks the king',
              'No reason',
            ],
            answer: 0,
            why: 'Two breaks: if one is hard to play, use the other.',
          },
        },
      ],
    },
    {
      id: 'c4quiet',
      name: 'Quiet c4 systems and the Fianchetto',
      white: '1.d4 and 2.c4 without an early e4',
      games: 39,
      plan: {
        structure: 'White: c4 and d4 with e3, Bf4, Bg5 or g3. You: the KID set-up, then ...e5 or ...c5.',
        ideas: [
          'Against e3, play ...Nbd7 and ...e5: White has less space than in the main lines.',
          'Against Bf4 or Bg5, ...c5 hits d4; after exd4, ...Qb6 eyes b2.',
          'Against the Fianchetto (g3, Bg2), ...Nbd7 and ...e5 with ...c6 and ...Re8.',
        ],
        yourGames: '34 games with c4 but no e4, where you scored 60%, plus 5 Fianchetto games where you scored 20%.',
      },
      lines: [
        {
          id: 'c4-e3',
          name: '4.e3 and 6.Be2: ...Nbd7 and ...e5',
          pgn: `1.d4 Nf6 2.c4 g6 3.Nc3 Bg7
            4.e3 {Modest: White doesn't take the whole centre.}
            O-O 5.Nf3 d6 6.Be2 Nbd7 {#breaks Prepares ...e5.}
            7.O-O e5 {#breaks The break. Black is comfortable.}`,
          plan: {
            q: 'What will you do if White plays d5 after ...e5?',
            options: [
              'Plan ...Nc5 and ...a5, then ...f5 after the f6 knight moves',
              'Resign',
              'Play ...c6 and open the queenside at any cost',
            ],
            answer: 0,
            why: 'Closed centre: good squares for your knights, then the kingside break.',
          },
        },
        {
          id: 'c4-e3-bd3',
          name: '4.e3 and 6.Bd3: ...Nbd7, ...e5 and ...Re8',
          pgn: `1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e3 O-O 5.Nf3 d6
            6.Bd3 {The bishop aims at your king.}
            Nbd7 7.O-O e5 8.Qc2 Re8 {#open The rook supports e5 and gets ready for an open e-file.}`,
          plan: {
            q: 'Why ...Re8?',
            options: [
              'It supports e5 and prepares for the e-file to open',
              'It protects the king from Bd3',
              'It prepares ...Rxe3',
            ],
            answer: 0,
            why: 'Develop with purpose: the rook belongs on the file that will open.',
          },
        },
        {
          id: 'c4-bf4',
          name: '4.Bf4: ...c5 and ...cxd4',
          pgn: `1.d4 Nf6 2.c4 g6 3.Nc3 Bg7
            4.Bf4 {A London with c4.}
            d6 5.e3 O-O 6.Nf3 c5 {#quiet Hit d4, as against the London.}
            7.Be2 cxd4 8.exd4 Nc6 {#open Pressure on d4; ...Bg4 or ...Qb6 can follow.}`,
          plan: {
            q: 'Which White pawn is your main target here?',
            options: ['d4', 'c4', 'h2'],
            answer: 0,
            why: 'Find the target: d4 is hit by your knight, bishop and the c-file.',
          },
        },
        {
          id: 'c4-bg5',
          name: '5.Bg5: ...c5, ...h6 and ...Qb6',
          pgn: `1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.Nf3 d6
            5.Bg5 {Pinning the knight.}
            O-O 6.e3 c5 {#breaks Hit d4.}
            7.Be2 h6 8.Bh4 {Asking first: the bishop has to choose.}
            cxd4 9.exd4 Qb6 {#quiet b2 and d4 are the targets, the bishop has left c1.}`,
          plan: {
            q: 'Your queen on b6 hits two targets. Which?',
            options: ['b2 and d4', 'h2 and g1', 'c4 and e4'],
            answer: 0,
            why: 'With White’s dark-squared bishop away from c1, b2 is loose.',
          },
        },
        {
          id: 'fianchetto',
          name: 'Fianchetto (g3, Bg2): ...Nbd7, ...e5, ...c6',
          pgn: `1.d4 Nf6 2.c4 g6 3.Nf3 Bg7
            4.g3 {The Fianchetto: White's bishop on g2 mirrors yours.}
            O-O 5.Bg2 d6 6.O-O Nbd7 {#breaks Prepares ...e5.}
            7.Nc3 e5 8.e4 c6 {#develop Covers d5, prepares ...Qb6 or ...Qa5, and gives the queen room.}
            9.h3 Re8 {#open Supporting e5 so the centre can be released on your terms.}
            10.Be3 exd4 11.Nxd4 Qe7 {#open Pressure on e4: the queen and rook both hit it.}`,
          plan: {
            q: 'After ...exd4 Nxd4, what is your target?',
            options: ['The e4 pawn, hit by the rook, queen and f6 knight', 'The g2 bishop', 'The a2 pawn'],
            answer: 0,
            why: 'Open centre: pieces and files. The half-open e-file points at e4.',
          },
        },
      ],
    },
    {
      id: 'bg5',
      name: 'Trompowsky and Torre (Bg5)',
      white: '1.d4 with an early Bg5',
      games: 14,
      plan: {
        structure: 'White: an early Bg5, often Bxf6. You: the bishop pair and the long diagonal.',
        ideas: [
          'If White takes on f6, you get the bishop pair. Open the position for it.',
          'After Bxf6 Bxf6, b2 is often loose on the long diagonal: check ...Bxb2 every move.',
          'Against the Torre with Nbd2 and c3: ...Nbd7 and ...e5.',
        ],
        yourGames: '14 games, but 67% of the Torre games had a mistake by move 10, including a missed free pawn on b2.',
      },
      lines: [
        {
          id: 'tromp',
          name: 'Trompowsky: 2.Bg5 g6 3.Bxf6 exf6',
          pgn: `1.d4 Nf6
            2.Bg5 {The Trompowsky: White offers to give up the bishop for your knight.}
            g6 {#bishop Your usual set-up. If Bxf6, you get the bishop pair.}
            3.Bxf6 exf6 {#bishop The natural recapture. You now have the bishop pair, and the half-open e-file is ready for a rook.}
            4.e3 Bg7 5.c4 f5 {#bishop Unblocking the g7 bishop and controlling e4.}
            6.Nc3 O-O 7.Nf3 d6 8.Be2 c5 {#breaks Hit d4. Your two bishops love an open position.}`,
          plan: {
            q: 'You have two bishops against bishop and knight. What do they want?',
            options: ['Open lines: pawn breaks like ...c5 and ...f4', 'A locked centre', 'Queen trades at any cost'],
            answer: 0,
            why: 'The bishop pair is strongest in open positions.',
          },
        },
        {
          id: 'torre',
          name: 'Torre: Nbd2, e3, c3, ...Nbd7 and ...e5',
          pgn: `1.d4 Nf6 2.Nf3 g6
            3.Bg5 {The Torre Attack.}
            Bg7 4.Nbd2 O-O 5.e3 d6 6.c3
            Nbd7 {#breaks The masters' choice: prepare ...e5.}
            7.Be2 e5 {#breaks The break.}
            8.O-O h6 {Asking the bishop with a purpose: it has to commit.}
            9.Bh4 Qe8 {Unpinning the f6 knight. Now ...Nh5 or ...e4 are ideas.}`,
          plan: {
            q: 'Why ...Qe8?',
            options: ['To break the pin on the f6 knight', 'To defend the king', 'To prepare ...Qxe3'],
            answer: 0,
            why: 'A pinned knight can’t join the fight. Unpin, then play.',
          },
        },
        {
          id: 'torre-bxf6',
          name: 'Torre: 4.Bxf6 Bxf6, the long diagonal',
          pgn: `1.d4 Nf6 2.Nf3 g6 3.Bg5 Bg7
            4.Bxf6 Bxf6 {#bishop You get the bishop pair, and from f6 the bishop eyes d4 and b2 down the long diagonal.}
            5.e4 d6 6.c3 {Covering d4 and the long diagonal.}
            O-O 7.Bc4 e5 {#breaks Hit d4 and open the diagonal for your bishops. Black is slightly better.}`,
          plan: {
            q: 'After Bxf6 Bxf6, what should you check every move?',
            options: ['Whether b2 or d4 is loose on the long diagonal', 'Whether you can castle long', 'Whether your rook can reach h8'],
            answer: 0,
            why: 'Checks, captures, threats: in your games you missed a free pawn on b2 in this exact structure.',
          },
        },
      ],
    },
    {
      id: 'flank',
      name: 'Flank openings (1.Nf3, 1.c4, 1.b3, 1.e3, 1.g3)',
      white: 'Anything but 1.d4 and 1.e4',
      games: 60,
      plan: {
        structure: 'White: a fianchetto or a quiet set-up. You: the same KID set-up, then ...e5.',
        ideas: [
          'The set-up is the same against almost everything: ...Nf6, ...g6, ...Bg7, ...O-O, ...d6, ...e5.',
          'Against a fianchetto, ...e5 and ...Nc6 build a solid centre; ...a5 stops b4.',
          'Against 1.b3 and Bb2, ...e5 blocks the long diagonal toward your king.',
        ],
        yourGames: 'You scored well here: 69% against 1.Nf3 and 71% against 1.c4.',
      },
      lines: [
        {
          id: 'kia',
          name: "King's Indian Attack: 1.Nf3, g3, d3, e4",
          pgn: `1.Nf3 Nf6 2.g3 g6 3.Bg2 Bg7 4.O-O O-O 5.d3 d6
            6.e4 e5 {#breaks Meet e4 with ...e5: a mirror image of your own set-up.}
            7.Nc3 Nc6 8.h3
            a5 {Gaining queenside space and stopping a3 and b4 ideas.}`,
          plan: {
            q: 'The position is nearly symmetrical. What will decide it?',
            options: ['Who gets their pawn break in first (...f5 for you, f4 for White)', 'Who castles first', 'Nothing: it is a draw'],
            answer: 0,
            why: 'Pawn breaks are your counterplay.',
          },
        },
        {
          id: 'english',
          name: 'English: 1.c4, g3, Bg2',
          pgn: `1.c4 Nf6 2.Nc3 g6 3.g3 Bg7 4.Bg2 O-O 5.Nf3 d6 6.O-O
            e5 {#breaks Central space: White's bishop on g2 now bites on a pawn.}
            7.d3 Nc6 8.Rb1 {Preparing b4.}
            a5 {Stops b4 for now.}`,
          plan: {
            q: 'Why ...a5?',
            options: ['To slow White’s b4 and queenside expansion', 'To attack the king', 'To open the a-file for your rook'],
            answer: 0,
            why: 'Restrain your opponent’s plan before carrying out yours.',
          },
        },
        {
          id: 'english-e4',
          name: 'English with e4 and d4: a transposition',
          pgn: `1.c4 Nf6 2.Nc3 g6
            3.e4 d6 {#e5push Stop e4-e5 first.}
            4.d4 Bg7 5.Nf3 O-O 6.Be2 e5 7.O-O Nc6 {#breaks The Classical King's Indian, reached from the English.}`,
          plan: {
            q: 'You are in the Classical King’s Indian. What is your plan if White plays d5?',
            options: ['...Ne7, then ...f5 on the kingside', '...b5 on the queenside', '...h5 and ...h4'],
            answer: 0,
            why: 'Closed centre: attack where your pawns point.',
          },
        },
        {
          id: 'larsen',
          name: 'Nimzo-Larsen: 1.b3 Bb2, ...e5',
          pgn: `1.b3 Nf6 2.Bb2 g6 3.e3 Bg7 4.f4 d6 5.Nf3 O-O 6.Be2
            e5 {#bishop Block the b2 bishop's diagonal.}
            7.fxe5 Ng4 {#cct The pawn comes back: ...Nxe5 next, and your pieces are active.}`,
          plan: {
            q: 'After 7.fxe5, how do you get the pawn back?',
            options: ['...Ng4 and ...Nxe5 (or ...dxe5)', 'You can’t', '...Qe7 and ...Qxe5'],
            answer: 0,
            why: 'Checks, captures, threats: count the attackers on e5.',
          },
        },
        {
          id: 'e3-first',
          name: '1.e3: Bd3, Nf3, O-O and c4',
          pgn: `1.e3 Nf6 2.d4 g6 3.Bd3 Bg7 4.Nf3 O-O 5.O-O d6
            6.c4 Nbd7 7.Nc3 e5 {#breaks The same plan as against the Colle.}`,
          plan: {
            q: 'Which plan from the Colle chapter did you use here?',
            options: ['...Nbd7 and ...e5', '...c5 and ...Qb6', '...h6 and ...g5'],
            answer: 0,
            why: 'One plan, many move orders.',
          },
        },
      ],
    },
    {
      id: 'tricks',
      name: 'Early tricks: take the free pawn',
      white: 'Early gambits such as 1.d4 Nf6 2.e4',
      games: 4,
      plan: {
        structure: 'White offers a pawn on move 2. You: take it, then develop normally.',
        ideas: [
          'Before playing your set-up move, look at what White’s last move allows: 2.e4?! leaves the pawn hanging.',
          'After ...Nxe4, bring the knight back to f6 when it is attacked, then develop as usual.',
        ],
        yourGames: 'In three games you answered 2.e4?! with 2...g6 or 2...d6 instead of taking: Stockfish rates 2...Nxe4 more than half a pawn better.',
      },
      lines: [
        {
          id: 'trick-e4',
          name: '1.d4 Nf6 2.e4?!: 2...Nxe4',
          pgn: `1.d4 Nf6
            2.e4 {A gambit: the e4 pawn is unprotected.}
            Nxe4 {#cct Take it. Checks, captures, threats: White's last move left a pawn hanging.}
            (2...g6 {#cct You played this on autopilot. The pawn was free.})
            3.Bd3 Nf6 {#develop The knight goes back to safety. You are a pawn up.}
            4.Nf3 g6 5.O-O Bg7 {#develop Your normal set-up, with an extra pawn.}`,
          plan: {
            q: 'What habit would have saved this pawn in your games?',
            options: ['Asking “what did White’s last move allow?” before playing my set-up move', 'Always playing ...g6 on move 2', 'Moving faster'],
            answer: 0,
            why: 'Checks, captures, threats: both ways, every move.',
          },
        },
        {
          id: 'trick-nf3-e4',
          name: '1.Nf3 Nf6 2.e4?!: 2...Nxe4',
          pgn: `1.Nf3 Nf6
            2.e4 {The same idea after 1.Nf3: e4 is loose.}
            Nxe4 {#cct Take the pawn.}
            (2...d6 {#cct You played this. Take the free pawn instead.})
            3.d3 Nf6 4.d4 g6 {#develop A pawn up with your usual set-up.}`,
          plan: {
            q: 'White attacked your e4 knight with d3. What is the safest retreat?',
            options: ['...Nf6, back to its best square', '...Nxf2, grabbing more', '...Nd6'],
            answer: 0,
            why: 'Develop and consolidate when you are ahead in material.',
          },
        },
      ],
    },
  ],
};
