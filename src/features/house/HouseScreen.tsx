import { copy } from '@/copy';
import { DisabledRow, NavRow } from '@/ui';

/** House hub. Grocery list works; the rest say plainly that they are not available (never dead links). */
export function HouseScreen() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <NavRow to="/house/groceries" icon="receipt" title={copy.house.groceries} body={copy.house.groceriesBody} />
      <NavRow to="/house/announcements" icon="mail" title={copy.house.announcements} body={copy.house.announcementsBody} />
      <DisabledRow icon="house" title={copy.house.inventory} reason={copy.house.notAvailable} />
      <DisabledRow icon="calendar" title={copy.house.calendar} reason={copy.house.notAvailable} />
      <DisabledRow icon="bell" title={copy.house.concerns} reason={copy.house.notAvailable} />
      <DisabledRow icon="user" title={copy.house.contacts} reason={copy.house.notAvailable} />
    </div>
  );
}
