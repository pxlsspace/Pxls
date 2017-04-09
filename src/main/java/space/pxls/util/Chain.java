package space.pxls.util;

import java.util.ArrayList;
import java.util.List;

public class Chain<T> {
    @FunctionalInterface
    public interface Listener<T> {
        boolean handle(T obj);
    }

    private List<Listener<T>> listeners = new ArrayList<>();

    public Chain<T> add(Listener<T> listener) {
        listeners.add(listener);
        return this;
    }

    public void handle(T obj) {
        for (Listener<T> listener : listeners) {
            if (listener.handle(obj)) break;
        }
    }
}
