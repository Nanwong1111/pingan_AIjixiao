
create table public.subordinate_data (
  id uuid primary key default gen_random_uuid(),
  sub_id text unique not null,
  name text not null,
  monthly_report jsonb not null default '{}'::jsonb,
  last_supervisor_feedback jsonb not null default '{}'::jsonb,
  work_emails jsonb not null default '[]'::jsonb,
  chat_messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.feedback_records (
  id uuid primary key default gen_random_uuid(),
  sub_id text not null,
  sub_name text not null,
  score integer not null,
  highlights text not null,
  shortcomings text not null,
  next_focus text not null,
  scores_detail jsonb not null default '{}'::jsonb,
  email_sent boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_feedback_records_sub_id on public.feedback_records(sub_id);
create index idx_feedback_records_created_at on public.feedback_records(created_at desc);

alter table public.subordinate_data enable row level security;
alter table public.feedback_records enable row level security;

-- Demo: public read/insert (no auth in this prototype workbench)
create policy "public read subordinate_data" on public.subordinate_data for select using (true);
create policy "public read feedback_records" on public.feedback_records for select using (true);
create policy "public insert feedback_records" on public.feedback_records for insert with check (true);
create policy "public update feedback_records" on public.feedback_records for update using (true);

-- Seed
insert into public.subordinate_data (sub_id, name, monthly_report, last_supervisor_feedback, work_emails, chat_messages) values
('1', '周颖',
 '{"highlights":"方案质量稳定，客户沟通有效；本月完成12+个重点产品部门长访谈，推动数字化产品方案设计落地。","shortcomings":"方案创新性需提升，部分方案模板化程度较高。","next_plan":"聚焦尖刀产品解决方案打磨；推动方案复用率提升。","period":"2026-03"}',
 '{"score":83,"highlights":"方案质量稳定，客户沟通有效","shortcomings":"方案创新性需提升","next_focus":"聚焦尖刀产品解决方案打磨","period":"2026-02"}',
 '[{"subject":"重点客户方案评审反馈","from":"客户A","date":"2026-03-12","summary":"客户对方案A表示高度认可，签约提前。"},{"subject":"产品长访谈纪要 - 数据中台","from":"产品部","date":"2026-03-18","summary":"完成数据中台访谈，沉淀方案要点。"},{"subject":"复用率提升专项","from":"运营组","date":"2026-03-22","summary":"本月方案复用率 28%，需进一步提升。"}]'::jsonb,
 '[{"channel":"客户群-A","date":"2026-03-08","summary":"周颖牵头协调客户技术对接，推动方案确认。"},{"channel":"团队群","date":"2026-03-21","summary":"周颖分享尖刀产品打磨思路，团队反馈积极。"}]'::jsonb),
('3', '肖敏',
 '{"highlights":"完成3个综合解决方案的端到端落地，客户NPS高。","shortcomings":"对外发声偏少。","next_plan":"沉淀方法论，对外做行业分享。","period":"2026-03"}',
 '{"score":88,"highlights":"专业能力突出","shortcomings":"团队影响力可加强","next_focus":"扩大方法论传播","period":"2026-02"}',
 '[{"subject":"方案验收通过","from":"客户B","date":"2026-03-15","summary":"客户验收顺利，反馈良好。"}]'::jsonb,
 '[{"channel":"方案中心","date":"2026-03-19","summary":"肖敏带领评审会议，提出关键改进点。"}]'::jsonb),
('4', '李航',
 '{"highlights":"主导2项数字化产品立项。","shortcomings":"项目排期推进偏慢。","next_plan":"加强项目节奏管理。","period":"2026-03"}',
 '{"score":79,"highlights":"产品视野好","shortcomings":"执行节奏偏慢","next_focus":"强化里程碑管理","period":"2026-02"}',
 '[{"subject":"立项评审通过","from":"PMO","date":"2026-03-10","summary":"两项产品立项顺利通过。"}]'::jsonb,
 '[{"channel":"产品组","date":"2026-03-22","summary":"李航对接需求方，推进排期协调。"}]'::jsonb),
('8', '吴迪',
 '{"highlights":"重点客户续约风险识别及时，完成3个关键客户回访闭环。","shortcomings":"客户成功案例沉淀还不够系统。","next_plan":"补齐客户健康度看板，形成季度复盘模板。","period":"2026-03"}',
 '{"score":84,"highlights":"客户响应及时，风险跟进主动","shortcomings":"案例复盘体系需加强","next_focus":"完善客户健康度管理","period":"2026-02"}',
 '[{"subject":"续约风险沟通纪要","from":"客户C","date":"2026-03-11","summary":"吴迪推动续约风险事项闭环，客户认可响应速度。"}]'::jsonb,
 '[{"channel":"客户成功组","date":"2026-03-20","summary":"吴迪同步客户健康度分层，明确高风险客户跟进计划。"}]'::jsonb),
('9', '刘欣',
 '{"highlights":"交付质量检查覆盖率提升，重点项目验收问题下降。","shortcomings":"跨组质量标准宣贯节奏还需加快。","next_plan":"推进质量检查清单统一，并组织专项复盘。","period":"2026-03"}',
 '{"score":86,"highlights":"质量把控稳定，问题闭环及时","shortcomings":"标准化宣贯不足","next_focus":"强化跨组质量标准落地","period":"2026-02"}',
 '[{"subject":"质量周报反馈","from":"交付中心","date":"2026-03-14","summary":"重点项目缺陷率下降，质量检查清单执行有效。"}]'::jsonb,
 '[{"channel":"交付质量群","date":"2026-03-25","summary":"刘欣组织质量问题复盘，输出改进项负责人。"}]'::jsonb),
('11', '许诺',
 '{"highlights":"完成行业方案材料更新，支持2个售前关键节点。","shortcomings":"部分材料对客户业务场景的匹配度仍可提升。","next_plan":"加强行业场景调研，补充标杆案例。","period":"2026-03"}',
 '{"score":80,"highlights":"方案材料响应快","shortcomings":"场景贴合度需提升","next_focus":"增强行业案例沉淀","period":"2026-02"}',
 '[{"subject":"行业方案材料评审","from":"售前团队","date":"2026-03-16","summary":"许诺提交新版行业方案材料，支撑客户评审。"}]'::jsonb,
 '[{"channel":"方案顾问群","date":"2026-03-23","summary":"许诺征集行业案例素材，准备补充标杆案例库。"}]'::jsonb),
('12', '高洁',
 '{"highlights":"项目运营台账完整，风险升级机制执行到位。","shortcomings":"部分项目资源冲突需更早预警。","next_plan":"完善资源冲突预警规则，提升周例会决策效率。","period":"2026-03"}',
 '{"score":89,"highlights":"项目节奏掌控好，风险闭环强","shortcomings":"资源预警前置不足","next_focus":"优化资源冲突预警","period":"2026-02"}',
 '[{"subject":"项目运营月报","from":"PMO","date":"2026-03-19","summary":"高洁维护的项目台账准确，风险升级闭环及时。"}]'::jsonb,
 '[{"channel":"项目运营群","date":"2026-03-27","summary":"高洁推动跨部门排期确认，减少项目等待时间。"}]'::jsonb),
('14', '罗婷',
 '{"highlights":"服务体验问题闭环率提升，客户投诉响应时效改善。","shortcomings":"体验数据分析维度仍偏基础。","next_plan":"建设体验问题标签体系，支持根因分析。","period":"2026-03"}',
 '{"score":81,"highlights":"投诉响应及时，闭环意识强","shortcomings":"数据分析深度不足","next_focus":"完善体验分析标签","period":"2026-02"}',
 '[{"subject":"服务体验问题复盘","from":"客户服务部","date":"2026-03-17","summary":"罗婷推动高频问题复盘，明确改进动作。"}]'::jsonb,
 '[{"channel":"服务体验群","date":"2026-03-24","summary":"罗婷整理体验问题标签初稿，邀请一线补充反馈。"}]'::jsonb),
('15', '黄静',
 '{"highlights":"客户服务工单处理稳定，复杂问题升级及时。","shortcomings":"主动服务提醒覆盖不足。","next_plan":"建立重点客户主动提醒清单。","period":"2026-03"}',
 '{"score":78,"highlights":"工单处理稳定","shortcomings":"主动服务意识需加强","next_focus":"提升主动触达覆盖","period":"2026-02"}',
 '[{"subject":"工单处理反馈","from":"客户服务平台","date":"2026-03-13","summary":"黄静负责的复杂工单均按时升级并完成闭环。"}]'::jsonb,
 '[{"channel":"客服一线群","date":"2026-03-21","summary":"黄静同步高频工单处理经验，便于团队复用。"}]'::jsonb),
('17', '林悦',
 '{"highlights":"协助完成方案资料整理，支持客户演示材料更新。","shortcomings":"独立推动复杂事项的能力仍需提升。","next_plan":"承担一个小型方案模块的独立交付。","period":"2026-03"}',
 '{"score":87,"highlights":"支撑响应快，材料质量好","shortcomings":"独立推进经验不足","next_focus":"提升独立交付能力","period":"2026-02"}',
 '[{"subject":"客户演示材料更新","from":"方案中心","date":"2026-03-18","summary":"林悦整理演示材料并完成版本校对。"}]'::jsonb,
 '[{"channel":"方案支持群","date":"2026-03-26","summary":"林悦跟进方案素材归档，方便后续复用。"}]'::jsonb),
('18', '邓睿',
 '{"highlights":"客户运营活动执行顺利，触达数据较上月提升。","shortcomings":"活动后转化分析还不够细。","next_plan":"补充客户分层转化分析，并优化活动跟进节奏。","period":"2026-03"}',
 '{"score":82,"highlights":"运营执行稳定","shortcomings":"转化分析不够深入","next_focus":"强化活动复盘分析","period":"2026-02"}',
 '[{"subject":"客户运营活动数据","from":"运营平台","date":"2026-03-20","summary":"邓睿负责活动触达率提升，后续需补充转化拆解。"}]'::jsonb,
 '[{"channel":"客户运营群","date":"2026-03-28","summary":"邓睿汇总活动反馈，准备下月优化方案。"}]'::jsonb),
('19', '唐琪',
 '{"highlights":"产品运营资料维护及时，支持上线沟通顺畅。","shortcomings":"用户反馈闭环跟进还可更主动。","next_plan":"建立上线后反馈跟踪表，推动问题分级处理。","period":"2026-03"}',
 '{"score":84,"highlights":"上线支持及时","shortcomings":"反馈闭环主动性不足","next_focus":"完善上线反馈跟踪","period":"2026-02"}',
 '[{"subject":"产品上线沟通","from":"产品部","date":"2026-03-12","summary":"唐琪完成上线资料维护，保障客户沟通一致。"}]'::jsonb,
 '[{"channel":"产品运营群","date":"2026-03-22","summary":"唐琪收集上线后用户反馈，准备问题分级。"}]'::jsonb),
('21', '宋佳',
 '{"highlights":"客户成功支持响应快，协助完成多轮客户培训。","shortcomings":"培训效果评估体系还需完善。","next_plan":"补充培训满意度与学习效果跟踪。","period":"2026-03"}',
 '{"score":80,"highlights":"客户培训支持到位","shortcomings":"效果评估不足","next_focus":"完善培训评估机制","period":"2026-02"}',
 '[{"subject":"客户培训反馈","from":"客户D","date":"2026-03-15","summary":"宋佳协助完成客户培训，参训方反馈清晰易懂。"}]'::jsonb,
 '[{"channel":"客户培训群","date":"2026-03-25","summary":"宋佳整理培训问题清单，推动产品答疑闭环。"}]'::jsonb),
('22', '蒋楠',
 '{"highlights":"质量运营数据整理准确，周度质量看板按时发布。","shortcomings":"异常指标的原因拆解还需更深入。","next_plan":"补充异常指标分析模板，提升问题定位效率。","period":"2026-03"}',
 '{"score":86,"highlights":"质量数据准确，看板稳定","shortcomings":"原因拆解深度不足","next_focus":"加强异常指标分析","period":"2026-02"}',
 '[{"subject":"质量看板发布","from":"质量运营平台","date":"2026-03-21","summary":"蒋楠按时发布质量看板，数据口径稳定。"}]'::jsonb,
 '[{"channel":"质量运营群","date":"2026-03-29","summary":"蒋楠同步异常指标初步分析，准备专项复盘。"}]'::jsonb),
('23', '袁博',
 '{"highlights":"方案交付支持响应及时，协助完成验收材料准备。","shortcomings":"对交付风险的预判还需加强。","next_plan":"参与项目风险评审，沉淀交付检查清单。","period":"2026-03"}',
 '{"score":77,"highlights":"交付支持积极","shortcomings":"风险预判不足","next_focus":"加强交付风险识别","period":"2026-02"}',
 '[{"subject":"验收材料准备","from":"交付中心","date":"2026-03-18","summary":"袁博协助准备验收材料，保障节点按期推进。"}]'::jsonb,
 '[{"channel":"方案交付群","date":"2026-03-27","summary":"袁博跟进验收材料反馈，补充交付检查项。"}]'::jsonb);
