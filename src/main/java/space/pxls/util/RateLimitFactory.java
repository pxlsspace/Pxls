package space.pxls.util;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class RateLimitFactory {
    private Map<String, Map<String, RequestBucket>> bucketMap = new ConcurrentHashMap<>();
    private Map<String, BucketConfig> bucketConfigs = new ConcurrentHashMap<>();

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
            if (old.startTime + bucketConfig.resetSeconds * 1000 < System.currentTimeMillis())
                return new RequestBucket(System.currentTimeMillis(), 0);
            return old;
        });

        int toRet = bucket.count >= bucketConfig.maxRequests ? (int) Math.ceil(((bucket.startTime + bucketConfig.resetSeconds * 1000) - System.currentTimeMillis()) / 1000f) : 0;
        if (increaseBucket) bucket.count++;
        return toRet;
    }

    public static class BucketConfig {
        public int resetSeconds;
        public int maxRequests;
        public boolean global;

        public BucketConfig(int resetSeconds, int maxRequests) {
            this.resetSeconds = resetSeconds;
            this.maxRequests = maxRequests;
            this.global = false;
        }

        public BucketConfig(int resetSeconds, int maxRequests, boolean global) {
            this.resetSeconds = resetSeconds;
            this.maxRequests = maxRequests;
            this.global = global;
        }

        @Override
        public String toString() {
            return String.format("%ss / %s", resetSeconds, maxRequests);
        }
    }

    public static class RequestBucket {
        public long startTime;
        public int count;

        public RequestBucket(long startTime, int count) {
            this.startTime = startTime;
            this.count = count;
        }

        @Override
        public String toString() {
            return String.format("%s / %s", startTime, count);
        }
    }
}
