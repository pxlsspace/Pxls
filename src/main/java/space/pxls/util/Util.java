package space.pxls.util;

import com.typesafe.config.ConfigException;

import java.util.Random;
import java.util.function.Supplier;

public class Util {
    public static String generateRandomToken() {
        String charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        Random rand = new Random();
        StringBuilder res = new StringBuilder();
        for (int i = 0; i <= 32; i++) {
            int randIndex = rand.nextInt(charset.length());
            res.append(charset.charAt(randIndex));
        }
        return res.toString();
    }

    /**
     * Returns a default value if the supplier throws ConfigException.Missing,
     * otherwise the value in the getter.
     * @param method Config getter supplier
     * @param val Default value
     * @param <T> Type of value
     * @return value or default value
     */
    public static <T> T defaultConfigVal(Supplier<T> method, T val) {
        try {
            return method.get();
        } catch (ConfigException.Missing ex) {
            return val;
        }
    }
}
