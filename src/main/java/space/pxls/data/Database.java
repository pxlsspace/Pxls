package space.pxls.data;

import org.skife.jdbi.v2.DBI;
import space.pxls.App;
import space.pxls.user.Role;
import space.pxls.user.User;

import java.io.Closeable;

public class Database implements Closeable {
    private final DBI dbi;
    private final DAO handle;

    public Database() {
        try {
            Class.forName("org.mariadb.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            e.printStackTrace();
        }

        dbi = new DBI(App.getConfig().getString("database.url"), App.getConfig().getString("database.user"), App.getConfig().getString("database.pass"));
        handle = dbi.open(DAO.class);

        handle.createPixelsTable();
        handle.createUsersTable();
    }

    public void placePixel(int x, int y, int color, User who, boolean mod_action) {
        handle.putPixel(x, y, (byte) color, who.getId(), mod_action);
        handle.updateUserTime(who.getId());
    }

    public void getPixelAt(int x, int y) {
        PixelPlacement result = handle.getPixel(x, y);
    }

    public void close() {
        handle.close();
    }

    public DBUser getUserByLogin(String login) {
        DBUser user = handle.getUserByLogin(login);
        return user;
    }

    public DBUser getUserByName(String name) {
        DBUser user = handle.getUserByName(name);
        if (user == null) return null;
        return user;
    }

    public DBUser createUser(String name, String login) {
        handle.createUser(name, login);
        DBUser user = getUserByName(name);
        return user;
    }

    public void setUserRole(User user, Role role) {
        handle.updateUserRole(user.getId(), role.name());
    }
}
