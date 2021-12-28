use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, near_bindgen, PanicOnDefault};
use near_sdk::collections::{Vector};
use near_sdk::BorshStorageKey;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

const BOARD_SIDE: usize = 10;
const BOARD_DIMENSIONS: usize = BOARD_SIDE * BOARD_SIDE;

#[derive(BorshStorageKey, BorshSerialize)]
pub enum StorageKeys {
    Board,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct NearCanvas {
    board: Vector<u8>
}


#[near_bindgen]
impl NearCanvas {

    #[init]
    pub fn new() -> Self {
        let mut v = Vector::new(StorageKeys::Board);
        v.extend(vec![0; BOARD_DIMENSIONS]);
        Self {
            board: v,
        }
    }

    pub fn put_pixel(&mut self, x: u64, y: u64, color: u8) {
        // let applicant = env::signer_account_id();
        env::log(self.board.len().to_string().as_bytes());
        self.board.replace(x + y * BOARD_SIDE as u64, &color);
    }

}