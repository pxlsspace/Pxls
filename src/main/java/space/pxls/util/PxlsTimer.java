package space.pxls.util;

public class PxlsTimer {
    private long lastRun;
    private float wait;

    public PxlsTimer(float wait) {
        this.wait = wait;
    }

    public void run(Runnable r) {
        if (lastRun + ((long) wait * 1000) < System.currentTimeMillis()) {
            lastRun = System.currentTimeMillis();

            r.run();
        }
    }
}
