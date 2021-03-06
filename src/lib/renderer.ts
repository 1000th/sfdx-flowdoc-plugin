import i18n from '../config/i18n';
import { WaitEventSummary } from '../types/flow';

const styles = require('../style/style.json');

export default class Renderer {
    flowParser;

    i18n;

    name;

    constructor(flowParser, locale: string, name: string) {
        this.flowParser = flowParser;
        this.i18n = i18n(locale);
        this.name = name;
    }

    createDocDefinition() {
        return {
            content: this.createContent(),
            styles,
            defaultStyle: {
                font: 'NotoSans',
            },
        };
    }

    createContent() {
        const content = [];
        // Title
        /*
        content.push({
            image: path.join(__dirname, '../assets/img/process_120.png'),
            fit: [30, 30]
        });
        */

        content.push({ text: this.flowParser.getLabel(), style: 'h1' });
        content.push({ text: this.name });

        content.push({ text: this.i18n.__('THE_PROCESS_STARTS_WHEN'), margin: [0, 10, 0, 5] });

        const object = this.flowParser.getObjectType();
        const triggerType =
            this.flowParser.getTriggerType() === 'onAllChanges'
                ? this.i18n.__('WHEN_A_RECORD_IS_CREATED_OR_EDITED')
                : this.i18n.__('ONLY_WHEN_A_RECORD_IS_CREATED');
        const overview = {
            layout: 'lightHorizontalLines',
            table: {
                widths: [200, 'auto'],
                body: [
                    [this.th(this.i18n.__('OBJECT')), object],
                    [this.th(this.i18n.__('WHEN_THE_PROCESS_STARTS')), triggerType],
                ],
            },
        };
        content.push(overview);

        const decisions = this.flowParser.getStandardDecisions();
        for (let i = 0; i < decisions.length; i++) {
            content.push(this.h2(`${this.i18n.__('ACTION_GROUP')} ${i + 1}`));
            const criteria = this.flowParser.getActionExecutionCriteria(decisions[i]);
            content.push(this.renderDecision(decisions[i], criteria));
            if (criteria === 'CONDITIONS_ARE_MET') {
                content.push(this.renderDecisionConditions(decisions[i].rules.conditions));
            }

            if (decisions[i].rules.connector) {
                const nextActionName = decisions[i].rules.connector.targetReference;
                const actions = this.flowParser.getActionSequence([], nextActionName);
                if (!actions || actions.length === 0) {
                    continue;
                }
                content.push(this.h3(this.i18n.__('HEADER_ACTIONS')));

                for (const action of actions) {
                    const actionTables = this.renderAction(action);
                    content.push(actionTables[0]);
                    if (actionTables.length > 1) {
                        content.push(actionTables[1]);
                    }
                }
                const lastAction = actions.slice(-1)[0];
                if (lastAction.connector) {
                    const scheduledActionSections = this.flowParser.getScheduledActionSections(
                        lastAction.connector.targetReference
                    );
                    if (!scheduledActionSections || scheduledActionSections.length === 0) {
                        continue;
                    }
                    content.push(this.h3(this.i18n.__('HEADER_SCHEDULED_ACTIONS')));
                    for (const section of scheduledActionSections) {
                        content.push(this.renderScheduledActionSummary(section.wait));
                        for (const action of section.actions) {
                            content.push(this.renderAction(action));
                        }
                    }
                }
            }
        }
        return content;
    }

    renderDecision(decision, criteria) {
        const table = {
            unbreakable: true,
            table: {
                widths: [200, 'auto'],
                body: [
                    [this.th(this.i18n.__('CONDITION_NAME')), decision.rules.label],
                    [this.th(this.i18n.__('CRITERIA_FOR_EXECUTING_ACTIONS')), this.i18n.__(criteria)],
                ],
            },
        };
        if (criteria === 'FORMULA_EVALUATES_TO_TRUE') {
            const formulaName = decision.rules.conditions.leftValueReference;
            const formulaExpression = this.flowParser.getFormulaExpression(formulaName);
            table.table.body.push([this.th(this.i18n.__('FORMULA')), unescape(formulaExpression)]);
        } else if (criteria === 'CONDITIONS_ARE_MET') {
            table.table.body.push([
                this.th(this.i18n.__('CONDITION_LOGIC')),
                decision.rules.conditionLogic.toUpperCase(),
            ]);
        }
        return table;
    }

    renderDecisionConditions = rawConditions => {
        const conditions = Array.isArray(rawConditions) ? rawConditions : [rawConditions];
        const conditionTable = {
            layout: 'lightHorizontalLines',
            unbreakable: true,
            table: {
                headerRows: 1,
                width: ['auto', 100, 'auto', 'auto'],
                body: [[this.i18n.__('FIELD'), this.i18n.__('OPERATOR'), this.i18n.__('TYPE'), this.i18n.__('VALUE')]],
            },
            margin: [15, 5, 0, 0],
        };
        for (const c of conditions) {
            conditionTable.table.body.push([
                c.leftValueReference,
                c.operator,
                Object.keys(c.rightValue)[0],
                Object.values(c.rightValue)[0],
            ]);
        }
        return conditionTable;
    };

    renderAction = action => {
        const actionTable = {
            unbreakable: true,
            table: {
                body: [
                    [this.th(this.i18n.__('ACTION_TYPE')), this.i18n.__(`ACTION_TYPE_${action.actionType}`)],
                    [this.th(this.i18n.__('ACTION_NAME')), action.label],
                ],
            },
            margin: [0, 0, 0, 10],
        };
        const actionDetail = this.flowParser.getActionDetail(action);
        for (const d of actionDetail.rows) {
            actionTable.table.body.push([
                this.th(this.i18n.__(`ACTION_DETAIL_${action.actionType}_${d.name}`)),
                d.value,
            ]);
        }

        if (actionDetail.fields && actionDetail.fields.length > 0) {
            const paramTable = {
                unbreakable: true,
                layout: 'lightHorizontalLines',
                table: {
                    body: [
                        [this.th(this.i18n.__('FIELD')), this.th(this.i18n.__('TYPE')), this.th(this.i18n.__('VALUE'))],
                    ],
                },
                margin: [15, 0, 0, 10],
            };
            for (const f of actionDetail.fields) {
                paramTable.table.body.push(f);
            }
            return [actionTable, paramTable];
        }
        return [actionTable];
    };

    renderScheduledActionSummary = (summary: WaitEventSummary) => {
        const direction = this.i18n.__(summary.isAfter ? 'AFTER' : 'BEFORE');
        const compareTo = summary.field ? summary.field : this.i18n.__('NOW');
        const unit = this.i18n.__(summary.unit.toUpperCase());
        return {
            text: `${summary.offset} ${unit} ${direction} ${compareTo}`,
            margin: [0, 5],
        };
    };

    th = text => {
        return { text, style: 'bold' };
    };

    h2 = text => {
        return { text, style: 'h2', margin: [0, 10] };
    };

    h3 = text => {
        return { text, style: 'h3', margin: [0, 10] };
    };
}
