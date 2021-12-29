use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, near_bindgen, PanicOnDefault};
use near_sdk::BorshStorageKey;
use crate::borsh::maybestd::{
    io::{Result, Write},
};


#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

const BOARD_SIDE: usize = 100;
const BOARD_DIMENSIONS: usize = BOARD_SIDE * BOARD_SIDE;

pub struct Board([u8; BOARD_DIMENSIONS]);

#[derive(BorshStorageKey, BorshSerialize)]
pub enum StorageKeys {
    Board,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct NearCanvas {
    board: Board
}

impl BorshSerialize for Board {
    
    #[inline]
    fn serialize<W: Write>(&self, writer: &mut W) -> Result<()> {
        let written: Result<usize> =  writer.write(&self.0);
        env::log(written.unwrap().to_string().as_bytes());
        Ok(())
        //self.0.serialize(writer)
    }
}

impl BorshDeserialize for Board {

    #[inline]
    fn deserialize(buf: &mut &[u8]) -> Result<Self> {
        let mut board = Board([0; BOARD_DIMENSIONS]);
        for i in 0..BOARD_DIMENSIONS {
            board.0[i] = buf[i]
        }
        *buf = &[];
        Ok(board)
    }
}

#[near_bindgen]
impl NearCanvas {

    #[init]
    pub fn new() -> Self {
        Self {
            board: Board([0; BOARD_DIMENSIONS])
        }

    }

    pub fn put_pixel(&mut self, x: usize, y: usize, color: u8) {
        // let applicant = env::signer_account_id();
        self.board.0[x + y * BOARD_SIDE] = color
    }

}