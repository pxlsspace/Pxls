package space.pxls;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

public class Game {
    private int width;
    private int height;
    private byte[] board;
    private List<String> palette;
    private int cooldown;

    public Game(int width, int height, List<String> palette, int cooldown) {
        this.width = width;
        this.height = height;
        this.board = new byte[width * height];
        this.palette = palette;
        this.cooldown = cooldown;
    }

    public void place(int x, int y, int color) {
        board[x + y * width] = (byte) color;
    }

    public int getWidth() {
        return width;
    }

    public int getHeight() {
        return height;
    }

    public byte[] getBoard() {
        return board;
    }

    public List<String> getPalette() {
        return palette;
    }

    public int getCooldown() {
        return cooldown;
    }

    public void setCooldown(int cooldown) {
        this.cooldown = cooldown;
    }

    public float getWaitTime(long lastPlace) {
        long nextPlace = lastPlace + cooldown * 1000;
        return Math.max(0, nextPlace - System.currentTimeMillis()) / 1000f;
    }

    public void loadBoard(Path boardFile) throws IOException {
        byte[] data = Files.readAllBytes(boardFile);
        System.arraycopy(data, 0, board, 0, Math.min(data.length, board.length));
    }

    public void saveBoard(Path boardFile) throws IOException {
        Files.createDirectories(boardFile.getParent());
        Files.write(boardFile, board);
    }

    public void setPixel(int x, int y, byte color) {
        board[x + y * width] = color;
    }

    public int getPixel(int x, int y) {
        return board[x + y * width];
    }
}
