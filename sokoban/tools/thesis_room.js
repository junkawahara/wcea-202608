'use strict';
// The repeated room of the exponential Sokoban construction
// (decoded from the figure in J. Potma, "An exponential construction for
//  Sokoban", Radboud University bachelor thesis, 2018; the construction
//  refines John Hoffman's room from E. Friedman's Math Magic, March 2000).
// 12 wide x 16 tall. '$' marks a box; every box starts on its own goal.
// Exits: A = left end of row 4, C = right end of row 4, B = bottom of column 5.
const ROOM = [
  '############',
  '########   #',
  '##   ## $  #',
  '# $  ## # ##',
  '  # ### #   ',
  '# # $ $  ###',
  '#  #   # ###',
  '## #     ###',
  '# $#### #  #',
  '#    ##  $ #',
  '#  #   ##  #',
  '###  # ##$ #',
  '## $##     #',
  '##    ###  #',
  '##  # ######',
  '##### ######',
];
module.exports = { ROOM };
