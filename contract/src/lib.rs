use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{near_bindgen};
use crate::borsh::maybestd::{
    io::{Result, Write},
};
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

const BOARD_SIDE: usize = 1000;
const BOARD_DIMENSIONS: usize = BOARD_SIDE * BOARD_SIDE;


pub struct Board([u8; BOARD_DIMENSIONS]);

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct NearCanvas {
    board: Board
}

impl BorshSerialize for Board {
    #[inline]
    fn serialize<W: Write>(&self, writer: &mut W) -> Result<()> {
        self.0.serialize(writer)
    }
}

impl BorshDeserialize for Board {
    fn deserialize(buf: &mut &[u8]) -> Result<Self> {
        let mut board = Board([0; BOARD_DIMENSIONS]);
        for i in 0..BOARD_DIMENSIONS {
            board.0[i] = buf[i]
        }
        Ok(board)
    }
}

impl Default for NearCanvas {
    fn default() -> NearCanvas {
        NearCanvas {
            board: Board([0; BOARD_DIMENSIONS])
        }
    }
}

#[near_bindgen]
impl NearCanvas {

    pub fn put_pixel(&mut self, x: usize, y: usize, color: u8) {
        // let applicant = env::signer_account_id();
        self.board.0[x * y * BOARD_SIDE] = color
    }

}