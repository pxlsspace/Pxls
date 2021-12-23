package space.pxls.util;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class RateLimitFactory {
    private final Map<String, Map<String, RequestBucket>> bucketMap = new ConcurrentHashMap<>();
    private final Map<String, BucketConfig> bucketConfigs = new ConcurrentHashMap<>();

    private static RateLimitFactory _instance;
    public static RateLimitFactory getInstance() {
        if (_instance == null) _instance = new RateLimitFactory();
        return _instance;
    }

    public static void registerBucketHolder(Class bucketType, BucketConfig bucketConfig) {
        RateLimitFactory.registerBucketHolder(bucketType.getSimpleName(), bucketConfig);
    }
    public static void registerBucketHolder(String bucketType, BucketConfig bucketConfig) {
        getInstance().bucketConfigs.put(bucketType, bucketConfig);
    }

    public static int getTimeRemaining(Class bucketType, String identifier) {
        return RateLimitFactory.getTimeRemaining(bucketType.getSimpleName(), identifier);
    }
    public static int getTimeRemaining(Class bucketType, String identifier, boolean increaseBucket) {
        return RateLimitFactory.getTimeRemaining(bucketType.getSimpleName(), identifier, increaseBucket);
    }
    public static int getTimeRemaining(String bucketType, String identifier) {
        return RateLimitFactory.getTimeRemaining(bucketType, identifier, true);
    }
    public static int getTimeRemaining(String bucketType, String identifier, boolean increaseBucket) {
        RateLimitFactory instance = getInstance();
        BucketConfig bucketConfig = instance.bucketConfigs.computeIfAbsent(bucketType, k -> {
            return new BucketConfig(60, 10);
        });
        RequestBucket bucket = getInstance().bucketMap.computeIfAbsent(bucketType, k -> new ConcurrentHashMap<>()).compute(identifier, (key, old) -> {
            if (old == null) return new RequestBucket(System.currentTimeMillis(), 0);
            if (old.getStartTime() + bucketConfig.getResetSeconds() * 1000L < System.currentTimeMillis())
                return new RequestBucket(System.currentTimeMillis(), 0);
            return old;
        });

        int toRet = bucket.getCount() >= bucketConfig.getMaxRequests()
            ? (int) Math.ceil(((bucket.getStartTime() + bucketConfig.getResetSeconds() * 1000) - System.currentTimeMillis()) / 1000f) : 0;
        if (increaseBucket) bucket.setCount(bucket.getCount() + 1);
        return toRet;
    }

    public static class BucketConfig {
        private int resetSeconds;
        private int maxRequests;
        private boolean global;

        public BucketConfig(int resetSeconds, int maxRequests) {
            this.setResetSeconds(resetSeconds);
            this.setMaxRequests(maxRequests);
            this.setGlobal(false);
        }

        public BucketConfig(int resetSeconds, int maxRequests, boolean global) {
            this.setResetSeconds(resetSeconds);
            this.setMaxRequests(maxRequests);
            this.setGlobal(global);
        }

        @Override
        public String toString() {
            return String.format("%ss / %s", getResetSeconds(), getMaxRequests());
        }

        public int getResetSeconds() {
            return resetSeconds;
        }

        public void setResetSeconds(int resetSeconds) {
            this.resetSeconds = resetSeconds;
        }

        public int getMaxRequests() {
            return maxRequests;
        }

        public void setMaxRequests(int maxRequests) {
            this.maxRequests = maxRequests;
        }

        public boolean isGlobal() {
            return global;
        }

        public void setGlobal(boolean global) {
            this.global = global;
        }
    }

    public static class RequestBucket {
        private long startTime;
        private int count;

        public RequestBucket(long startTime, int count) {
            this.setStartTime(startTime);
            this.setCount(count);
        }

        @Override
        public String toString() {
            return String.format("%s / %s", getStartTime(), getCount());
        }

        public long getStartTime() {
            return startTime;
        }

        public void setStartTime(long startTime) {
            this.startTime = startTime;
        }

        public int getCount() {
            return count;
        }

        public void setCount(int count) {
            this.count = count;
        }
    }
}
