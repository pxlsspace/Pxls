use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, near_bindgen, PanicOnDefault};
use near_sdk::collections::LazyOption;
use crate::borsh::maybestd::{
    io::{Result, Write},
};


#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

const BOARD_SIDE: usize = 1000;
const SHARD_SIDE: usize = 250;
const SHARD_DIMENSIONS: usize = SHARD_SIDE * SHARD_SIDE;
const MAX_COLOR: u8 = 28; // taken from Pxls palette.conf

pub struct BoardArray([u8; SHARD_DIMENSIONS]);

impl BorshSerialize for BoardArray {
    
    #[inline]
    fn serialize<W: Write>(&self, writer: &mut W) -> Result<()> {
        let written: Result<usize> =  writer.write(&self.0);
        env::log(written.unwrap().to_string().as_bytes());
        Ok(())
    }
}
impl BorshDeserialize for BoardArray {

    #[inline]
    fn deserialize(buf: &mut &[u8]) -> Result<Self> {
        let mut board = BoardArray([0; SHARD_DIMENSIONS]);
        for i in 0..SHARD_DIMENSIONS {
            board.0[i] = buf[i]
        }
        *buf = &[];
        Ok(board)        
    }
}


#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct NearCanvas {
    sh00: LazyOption<BoardArray>,
    sh01: LazyOption<BoardArray>,
    sh02: LazyOption<BoardArray>,
    sh03: LazyOption<BoardArray>,
    sh10: LazyOption<BoardArray>,
    sh11: LazyOption<BoardArray>,
    sh12: LazyOption<BoardArray>,
    sh13: LazyOption<BoardArray>,
    sh20: LazyOption<BoardArray>,
    sh21: LazyOption<BoardArray>,
    sh22: LazyOption<BoardArray>,
    sh23: LazyOption<BoardArray>,
    sh30: LazyOption<BoardArray>,
    sh31: LazyOption<BoardArray>,
    sh32: LazyOption<BoardArray>,
    sh33: LazyOption<BoardArray>,
}


#[near_bindgen]
impl NearCanvas {

    #[init]
    pub fn new() -> Self {
        Self {
            sh00: LazyOption::new(b"a", Some(&BoardArray([0; SHARD_DIMENSIONS]))),
            sh01: LazyOption::new(b"b", Some(&BoardArray([0; SHARD_DIMENSIONS]))),
            sh02: LazyOption::new(b"c", Some(&BoardArray([0; SHARD_DIMENSIONS]))),
            sh03: LazyOption::new(b"d", Some(&BoardArray([0; SHARD_DIMENSIONS]))),
            sh10: LazyOption::new(b"e", Some(&BoardArray([0; SHARD_DIMENSIONS]))),
            sh11: LazyOption::new(b"f", Some(&BoardArray([0; SHARD_DIMENSIONS]))),
            sh12: LazyOption::new(b"g", Some(&BoardArray([0; SHARD_DIMENSIONS]))),
            sh13: LazyOption::new(b"h", Some(&BoardArray([0; SHARD_DIMENSIONS]))),
            sh20: LazyOption::new(b"i", Some(&BoardArray([0; SHARD_DIMENSIONS]))),
            sh21: LazyOption::new(b"j", Some(&BoardArray([0; SHARD_DIMENSIONS]))),
            sh22: LazyOption::new(b"k", Some(&BoardArray([0; SHARD_DIMENSIONS]))),
            sh23: LazyOption::new(b"l", Some(&BoardArray([0; SHARD_DIMENSIONS]))),
            sh30: LazyOption::new(b"m", Some(&BoardArray([0; SHARD_DIMENSIONS]))),
            sh31: LazyOption::new(b"n", Some(&BoardArray([0; SHARD_DIMENSIONS]))),
            sh32: LazyOption::new(b"o", Some(&BoardArray([0; SHARD_DIMENSIONS]))),
            sh33: LazyOption::new(b"p", Some(&BoardArray([0; SHARD_DIMENSIONS]))),
        }

    }

    pub fn put_pixel(&mut self, x: usize, y: usize, color: u8) {
        if x >= BOARD_SIDE || y >= BOARD_SIDE {
            env::log(b"Illegal coordinates");
        } else if color > MAX_COLOR {
            env::log(b"Illegal color");
        } else {
            let shard = self.get_mutable_shard(x, y);
            let mut shard_data = shard.take().unwrap();
            shard_data.0[ x % SHARD_SIDE + (y % SHARD_SIDE) * SHARD_SIDE] = color;
            shard.set(&shard_data);
        }
    }

    pub fn get_pixel(& self, x: usize, y: usize) -> u8 {
        if x >= BOARD_SIDE || y >= BOARD_SIDE {
            env::log(b"Illegal coordinates");
            0
        } else {
            let shard= self.get_shard(x, y);
            let shard_data: [u8; SHARD_DIMENSIONS] = shard.get().unwrap().0;
            shard_data[ x % SHARD_SIDE + (y % SHARD_SIDE) * SHARD_SIDE]
        }
    }

    fn get_shard(&self, x: usize, y: usize) -> &LazyOption<BoardArray> {
        if x / SHARD_SIDE == 0 && y / SHARD_SIDE == 0 {
            env::log(format!("shard{}{}", 0, 0).as_bytes());
            &self.sh00
        } else if x / SHARD_SIDE == 0 && y / SHARD_SIDE == 1 {
            env::log(format!("shard{}{}", 0, 1).as_bytes());
            &self.sh01
        } else if x / SHARD_SIDE == 0 && y / SHARD_SIDE == 2 {
            env::log(format!("shard{}{}", 0, 2).as_bytes());
            &self.sh02
        } else if x / SHARD_SIDE == 0 && y / SHARD_SIDE == 3 {
            env::log(format!("shard{}{}", 0, 3).as_bytes());
            &self.sh03
        } else if x / SHARD_SIDE == 1 && y / SHARD_SIDE == 0 {
            env::log(format!("shard{}{}", 1, 0).as_bytes());
            &self.sh10
        } else if x / SHARD_SIDE == 1 && y / SHARD_SIDE == 1 {
            env::log(format!("shard{}{}", 1, 1).as_bytes());
            &self.sh11
        } else if x / SHARD_SIDE == 1 && y / SHARD_SIDE == 2 {
            env::log(format!("shard{}{}", 1, 2).as_bytes());
            &self.sh12
        } else if x / SHARD_SIDE == 1 && y / SHARD_SIDE == 3 {
            env::log(format!("shard{}{}", 1, 3).as_bytes());
            &self.sh13
        } else if x / SHARD_SIDE == 2 && y / SHARD_SIDE == 0 {
            env::log(format!("shard{}{}", 2, 0).as_bytes());
            &self.sh20
        } else if x / SHARD_SIDE == 2 && y / SHARD_SIDE == 1 {
            env::log(format!("shard{}{}", 2, 1).as_bytes());
            &self.sh21
        } else if x / SHARD_SIDE == 2 && y / SHARD_SIDE == 2 {
            env::log(format!("shard{}{}", 2, 2).as_bytes());
            &self.sh22
        } else if x / SHARD_SIDE == 2 && y / SHARD_SIDE == 3 {
            env::log(format!("shard{}{}", 2, 3).as_bytes());
            &self.sh23
        } else if x / SHARD_SIDE == 3 && y / SHARD_SIDE == 0 {
            env::log(format!("shard{}{}", 3, 0).as_bytes());
            &self.sh30
        } else if x / SHARD_SIDE == 3 && y / SHARD_SIDE == 1 {
            env::log(format!("shard{}{}", 3, 1).as_bytes());
            &self.sh31
        } else if x / SHARD_SIDE == 3 && y / SHARD_SIDE == 2 {
            env::log(format!("shard{}{}", 3, 2).as_bytes());
            &self.sh32
        } else {
            env::log(format!("shard{}{}", 3, 3).as_bytes());
            &self.sh33
        } 
    }

    fn get_mutable_shard(&mut self, x: usize, y: usize) -> &mut LazyOption<BoardArray> {
        if x / SHARD_SIDE == 0 && y / SHARD_SIDE == 0 {
            env::log(format!("shard{}{}", 0, 0).as_bytes());
            &mut self.sh00
        } else if x / SHARD_SIDE == 0 && y / SHARD_SIDE == 1 {
            env::log(format!("shard{}{}", 0, 1).as_bytes());
            &mut self.sh01
        } else if x / SHARD_SIDE == 0 && y / SHARD_SIDE == 2 {
            env::log(format!("shard{}{}", 0, 2).as_bytes());
            &mut self.sh02
        } else if x / SHARD_SIDE == 0 && y / SHARD_SIDE == 3 {
            env::log(format!("shard{}{}", 0, 3).as_bytes());
            &mut self.sh03
        } else if x / SHARD_SIDE == 1 && y / SHARD_SIDE == 0 {
            env::log(format!("shard{}{}", 1, 0).as_bytes());
            &mut self.sh10
        } else if x / SHARD_SIDE == 1 && y / SHARD_SIDE == 1 {
            env::log(format!("shard{}{}", 1, 1).as_bytes());
            &mut self.sh11
        } else if x / SHARD_SIDE == 1 && y / SHARD_SIDE == 2 {
            env::log(format!("shard{}{}", 1, 2).as_bytes());
            &mut self.sh12
        } else if x / SHARD_SIDE == 1 && y / SHARD_SIDE == 3 {
            env::log(format!("shard{}{}", 1, 3).as_bytes());
            &mut self.sh13
        } else if x / SHARD_SIDE == 2 && y / SHARD_SIDE == 0 {
            env::log(format!("shard{}{}", 2, 0).as_bytes());
            &mut self.sh20
        } else if x / SHARD_SIDE == 2 && y / SHARD_SIDE == 1 {
            env::log(format!("shard{}{}", 2, 1).as_bytes());
            &mut self.sh21
        } else if x / SHARD_SIDE == 2 && y / SHARD_SIDE == 2 {
            env::log(format!("shard{}{}", 2, 2).as_bytes());
            &mut self.sh22
        } else if x / SHARD_SIDE == 2 && y / SHARD_SIDE == 3 {
            env::log(format!("shard{}{}", 2, 3).as_bytes());
            &mut self.sh23
        } else if x / SHARD_SIDE == 3 && y / SHARD_SIDE == 0 {
            env::log(format!("shard{}{}", 3, 0).as_bytes());
            &mut self.sh30
        } else if x / SHARD_SIDE == 3 && y / SHARD_SIDE == 1 {
            env::log(format!("shard{}{}", 3, 1).as_bytes());
            &mut self.sh31
        } else if x / SHARD_SIDE == 3 && y / SHARD_SIDE == 2 {
            env::log(format!("shard{}{}", 3, 2).as_bytes());
            &mut self.sh32
        } else {
            env::log(format!("shard{}{}", 3, 3).as_bytes());
            &mut self.sh33
        } 
    }
}