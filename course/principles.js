// The big-picture ideas of the King's Indian. Every explanation in the course
// (lesson notes, mistake feedback) is tagged with one of these, so a single
// slip can be connected to the principle behind it.
export const PRINCIPLES = [
  {
    id: 'centre',
    title: 'Let White take the centre, then hit it',
    short: 'The King’s Indian lets White build a big pawn centre and then attacks it with pawns.',
    body:
      'You don’t fight for the centre with your first moves: ...Nf6, ...g6, ...Bg7 and ...O-O get your king safe and your best bishop aiming at d4. ' +
      'The fight starts a few moves later, when a pawn break (...e5 or ...c5) hits White’s centre. If you never strike, White simply has more space for free.',
  },
  {
    id: 'breaks',
    title: 'Pawn breaks are your counterplay',
    short: 'Your play comes from ...e5 or ...c5 (and later ...f5). Prepare one and play it.',
    body:
      'Around moves 6 to 10, pick a break: ...e5 (usually prepared with ...Nbd7 or ...Nc6, or ...Re8) or ...c5 (hitting d4 from the side). ' +
      'Before you push, count: how many White pieces hit the square, and how many of yours defend it? In your games, many first mistakes were slower moves played when a break was available.',
  },
  {
    id: 'bishop',
    title: 'The g7 bishop is your best piece',
    short: 'Keep the long diagonal open and don’t swap the g7 bishop cheaply.',
    body:
      'The bishop on g7 guards your king and x-rays d4, c3 and b2. Opening the centre with ...e5xd4 or ...c5xd4 makes it stronger. ' +
      'White often tries to trade it with Qd2 and Bh6. When you can, answer by striking the centre (...e5, ...c5) so the trade costs White time, and keep the h-file closed.',
  },
  {
    id: 'shield',
    title: 'Leave your king’s pawn shield alone',
    short: 'Moves like ...h6, ...Kh7, ...h5 or ...g5 loosen your king. Only play them with a concrete reason.',
    body:
      'After ...O-O your king is protected by the f7, g6 and h7 pawns and the g7 bishop. Every pawn move there creates a hole White can use (h6 for a bishop, g6 as a target for h4-h5). ' +
      'In your games, ...h6 and ...Kh7 were among the most common first mistakes: they spend a move without hitting the centre. Exceptions: ...h5 to stop h4-h5, and ...f5 when the centre is closed.',
  },
  {
    id: 'develop',
    title: 'Develop, castle, then fight',
    short: 'Knights and bishops out, king castled, then the pawn break. Don’t move a piece twice or bring the queen out early.',
    body:
      'The KID set-up is fast: ...Nf6, ...g6, ...Bg7, ...O-O, ...d6. Then the queen’s knight (to d7 or c6) supports the break. ' +
      'Moving the queen early or a piece twice gives White time to grab space.',
  },
  {
    id: 'e5push',
    title: 'Don’t let e4-e5 kick your knight',
    short: 'When White can play e4 and e5, put a pawn on d6 first so e5 can be met by ...dxe5.',
    body:
      'Your f6 knight is your main defender. If White gets a pawn to e5 while it can’t be captured, the knight has to run and White gains time and space. ' +
      'That’s why ...d6 comes before ...Bg7 or ...O-O when White already has Nc3 and e4. If e5 does come, a quick ...Nh5 (hitting a bishop on f4) or ...Nfd7 hits back.',
  },
  {
    id: 'cct',
    title: 'Checks, captures, threats: both ways',
    short: 'Before every move: what did White’s last move allow, and what does my move leave undefended?',
    body:
      'Look at White’s last move first. Did it leave a pawn or piece loose (a free pawn on e4 or b2)? Does it threaten something (Nd5 hitting c7, e4-e5 forking)? ' +
      'Then blunder-check your own move. Across your games, about a third of the first mistakes were missed captures, and you cashed in only about 6 in 10 of your opponents’ blunders.',
  },
  {
    id: 'chase',
    title: 'Hunt White’s active bishop',
    short: '...Nh5 against a bishop on f4 or g5, ...Ng4 against a bishop on e3: winning the bishop pair is worth a move.',
    body:
      'In the London and Jobava, White’s dark-squared bishop on f4 is its best piece and it fights your g7 bishop. ' +
      '...Nh5 attacks it: if it retreats, you have gained time; if White allows ...Nxf4 or ...Nxg3, you have the bishop pair and your g7 bishop has no rival.',
  },
  {
    id: 'closed',
    title: 'Closed centre: attack where your pawns point',
    short: 'When White plays d5, your d6-e5 pawns point at the kingside: play ...Nd7/...Ne8/...Nh5, ...f5, ...f4, ...g5.',
    body:
      'Once White locks the centre with d4-d5, the game splits into two races. White attacks on the queenside (c5, b4), and you attack the king with ...f5-f4 and ...g5-g4. ' +
      'The knight on f6 has to move first to let the f-pawn go: ...Nd7, ...Ne8 or ...Nh5.',
  },
  {
    id: 'open',
    title: 'Open centre: pieces and files',
    short: 'After pawn trades in the centre (dxe5 dxe5, ...cxd4), use open files, the d4 square and the long diagonal.',
    body:
      'When the centre opens, the game is about piece activity: rooks to open files (...Re8, ...Rd8), knights to central squares (d4 is a classic outpost), and the g7 bishop on the open long diagonal. ' +
      'In queenless positions after dxe5 dxe5 Qxd8, watch for Nd5 hitting c7 and e7.',
  },
  {
    id: 'quiet',
    title: 'Against quiet systems, strike before you’re squeezed',
    short: 'The London, Colle and e3 set-ups give you time. Use it for a break by move 8-10, not for waiting moves.',
    body:
      'Quiet systems don’t attack you early, so the danger is drifting: ...b6, ...a6, ...h6, ...Qd7 and similar moves let White finish developing and gain space. ' +
      'Against the London, ...c5 and ...Qb6 hit d4 and b2 (the bishop has left c1, so b2 is often weak). Against the Colle, ...e5 is easy because no White bishop watches e5.',
  },
  {
    id: 'attack',
    title: 'When White attacks your king, hit back in the centre',
    short: 'Against Qd2, Bh6, h4 and O-O-O: answer h4 with ...h5, and counter with ...c5, ...e5 or ...b5.',
    body:
      'White’s fastest attack against the KID is Qd2, Bh6 (to trade your bishop) and h4-h5 (to open the h-file). ' +
      'Don’t wait for it: a central break opens lines against a king that has castled long, and ...h5 stops h4-h5 in its tracks.',
  },
];

export const PRINCIPLE_BY_ID = Object.fromEntries(PRINCIPLES.map((p) => [p.id, p]));
