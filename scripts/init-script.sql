-- create db
create database quizlord;

create role quizlord with password 'quizlord';

ALTER ROLE quizlord WITH LOGIN;

\connect quizlord;
create schema quizlord;

grant all privileges on schema quizlord to quizlord;

grant all privileges on schema quizlord to postgres;

-- add search path
alter user quizlord
set
  search_path = "$user",
  public,
  quizlord;

alter user postgres
set
  search_path = "$user",
  public,
  quizlord;