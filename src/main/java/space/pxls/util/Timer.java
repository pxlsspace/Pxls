package space.pxls.util;

public class Timer {
    private long lastRun;
    private float wait;
    private Runnable r;

    public Timer(float wait) {
        this.wait = wait;
        this.r = r;
    }

    public void run(Runnable r) {
        if (lastRun + ((long) wait * 1000) < System.currentTimeMillis()) {
            lastRun = System.currentTimeMillis();

            r.run();
        }
    }
}
