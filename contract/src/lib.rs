use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, near_bindgen, PanicOnDefault};
use near_sdk::BorshStorageKey;
use crate::borsh::maybestd::{
    io::{Result, Write},
};


#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

const BOARD_SIDE: usize = 1000;
const SHARD_SIDE: usize = 250;
const BOARD_DIMENSIONS: usize = BOARD_SIDE * BOARD_SIDE;
const SHARD_DIMENSIONS: usize = SHARD_SIDE * SHARD_SIDE;

pub struct Board {
    sh00: [u8; SHARD_DIMENSIONS],
    sh01: [u8; SHARD_DIMENSIONS],
    sh02: [u8; SHARD_DIMENSIONS],
    sh03: [u8; SHARD_DIMENSIONS],
    sh10: [u8; SHARD_DIMENSIONS],
    sh11: [u8; SHARD_DIMENSIONS],
    sh12: [u8; SHARD_DIMENSIONS],
    sh13: [u8; SHARD_DIMENSIONS],
    sh20: [u8; SHARD_DIMENSIONS],
    sh21: [u8; SHARD_DIMENSIONS],
    sh22: [u8; SHARD_DIMENSIONS],
    sh23: [u8; SHARD_DIMENSIONS],
    sh30: [u8; SHARD_DIMENSIONS],
    sh31: [u8; SHARD_DIMENSIONS],
    sh32: [u8; SHARD_DIMENSIONS],
    sh33: [u8; SHARD_DIMENSIONS],
}

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
        let written: Result<usize> =  writer.write(&self.sh00);
        env::log(written.unwrap().to_string().as_bytes());
        Ok(())
        //self.0.serialize(writer)
    }
}

impl BorshDeserialize for Board {

    #[inline]
    fn deserialize(buf: &mut &[u8]) -> Result<Self> {
        let mut board = Board {
            sh00: [0; SHARD_DIMENSIONS],
            sh01: [0; SHARD_DIMENSIONS],
            sh02: [0; SHARD_DIMENSIONS],
            sh03: [0; SHARD_DIMENSIONS],
            sh10: [0; SHARD_DIMENSIONS],
            sh11: [0; SHARD_DIMENSIONS],
            sh12: [0; SHARD_DIMENSIONS],
            sh13: [0; SHARD_DIMENSIONS],
            sh20: [0; SHARD_DIMENSIONS],
            sh21: [0; SHARD_DIMENSIONS],
            sh22: [0; SHARD_DIMENSIONS],
            sh23: [0; SHARD_DIMENSIONS],
            sh30: [0; SHARD_DIMENSIONS],
            sh31: [0; SHARD_DIMENSIONS],
            sh32: [0; SHARD_DIMENSIONS],
            sh33: [0; SHARD_DIMENSIONS],
        };
        //board.0.copy_from_slice(buf);
        *buf = &[];
        Ok(board)
    }
}

#[near_bindgen]
impl NearCanvas {

    #[init]
    pub fn new() -> Self {
        Self {
            board: Board {
                sh00: [0; SHARD_DIMENSIONS],
                sh01: [0; SHARD_DIMENSIONS],
                sh02: [0; SHARD_DIMENSIONS],
                sh03: [0; SHARD_DIMENSIONS],
                sh10: [0; SHARD_DIMENSIONS],
                sh11: [0; SHARD_DIMENSIONS],
                sh12: [0; SHARD_DIMENSIONS],
                sh13: [0; SHARD_DIMENSIONS],
            }
        }

    }

    pub fn put_pixel(&mut self, x: usize, y: usize, color: u8) {
        // let applicant = env::signer_account_id();
        env::log(b"put_pixel!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        self.board.sh00[x + y * BOARD_SIDE] = color
    }

}