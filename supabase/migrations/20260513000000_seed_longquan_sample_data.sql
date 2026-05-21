insert into public.subordinate_data (sub_id, name, monthly_report, last_supervisor_feedback, work_emails, chat_messages) values
('2', '丁珂珂',
 '{"highlights":"车险年累计落后市场缺口缩小；小个非4月当月对标市场有改善；集团个金标签及策略完成上线；AI应用培训覆盖200余人。4月还推进个人事业群全国会、车险经营帮扶、HS项目、互联网车险模式梳理和AI组织升级。","shortcomings":"个旧提升对标人保仍有差距；HS合作主体集中度高、三级网点开单不足；众安数基拿回仍需跟进用足；个非新口径累计落后市场；K6组织相关工作需要加快。","next_plan":"确保车险及个非半年超市场，推进医疗险理赔、粤港跨境车险、信用卡权益和生命尊享托管等集团重点项目，做好监管沟通并加快HS模式突破、AI工具推广与K6组织相关工作。","period":"2026-04"}',
 '{"score":85,"highlights":"个非健康险创新取得进展；智小安AI工具得到监管及行业认可。","shortcomings":"车险及个非发展均存在一定问题；个全新客数达成不及预期；平台和线销模式变革较慢。","next_focus":"确保车险及个非半年超市场，推进集团重点项目，做好监管沟通、HS模式突破及能力建设，并加快AI与K6组织相关工作。","period":"2026-04"}',
 '[{"subject":"HS项目4月进展","from":"个人事业群","date":"2026-04-25","summary":"4月HS潜客累计31万，主体覆盖率和机构渗透率整体进度符合预期。"},{"subject":"个非健康险创新复盘","from":"健康险团队","date":"2026-04-28","summary":"慢病、乳腺癌、肺结节、AD症等产品上线，专病和中移动模式经验已在多家机构推广。"}]'::jsonb,
 '[{"channel":"个人事业群经营群","date":"2026-04-22","summary":"同步车险问题机构帮扶、互联网车险模式梳理和AI组织升级安排。"},{"channel":"HS专项群","date":"2026-04-29","summary":"强调合作主体集中度、三级网点开单不足及监管沟通后续动作。"}]'::jsonb)
on conflict (sub_id) do update set
  name = excluded.name,
  monthly_report = excluded.monthly_report,
  last_supervisor_feedback = excluded.last_supervisor_feedback,
  work_emails = excluded.work_emails,
  chat_messages = excluded.chat_messages;
