-- Grant "User" role to all existing users
insert into user_role
select id as user_id, 'USER' as "role"
from "user";
