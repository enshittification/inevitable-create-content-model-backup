import { addFilter } from '@wordpress/hooks';
import { useCallback, useMemo, useEffect, useState } from '@wordpress/element';
import { sprintf, __ } from '@wordpress/i18n';
import { createHigherOrderComponent } from '@wordpress/compose';
import {
	InspectorControls,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import {
	PanelBody,
	PanelRow,
	Button,
	ButtonGroup,
	__experimentalItemGroup as ItemGroup,
	__experimentalItem as Item,
	Flex,
	FlexBlock,
	FlexItem,
} from '@wordpress/components';
import { useSelect, useDispatch } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { createBlock, store as blocksStore } from '@wordpress/blocks';
import { useEntityProp } from '@wordpress/core-data';

import ManageBindings from './_manage-bindings';

import SUPPORTED_BLOCK_ATTRIBUTES from './_supported-attributes';

const ErrorMessage = ( { children } ) => {
	return (
		<span style={ { color: 'var(--wp--preset--color--vivid-red)' } }>
			{ children }
		</span>
	);
};

const withAttributeBinder = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		const { getBlockType } = useSelect( blocksStore );
		const {
			getBlockParentsByBlockName,
			getBlocksByClientId,
			getBlockOrder,
		} = useSelect( blockEditorStore );
		const { replaceInnerBlocks } = useDispatch( blockEditorStore );
		const { lockPostSaving, unlockPostSaving } = useDispatch( editorStore );
		const [ editingBoundAttribute, setEditingBoundAttribute ] =
			useState( null );

		const [ meta, setMeta ] = useEntityProp(
			'postType',
			window.contentModelFields.postType,
			'meta'
		);

		const fields = useMemo( () => {
			// Saving the fields as serialized JSON because I was tired of fighting the REST API.
			return meta?.fields ? JSON.parse( meta.fields ) : [];
		}, [ meta.fields ] );

		const { attributes, setAttributes, name, clientId } = props;

		const boundField = fields.find(
			( field ) => field.slug === attributes.metadata?.slug
		);

		const getBinding = useCallback(
			( attribute ) =>
				attributes.metadata?.[ window.BINDINGS_KEY ]?.[ attribute ],
			[ attributes.metadata ]
		);

		const removeBindings = useCallback( () => {
			const newAttributes = {
				metadata: {
					...( attributes.metadata ?? {} ),
				},
			};

			delete newAttributes.metadata[ window.BINDINGS_KEY ];
			delete newAttributes.metadata[ window.BLOCK_VARIATION_NAME_ATTR ];
			delete newAttributes.metadata.slug;

			const newFields = fields.filter(
				( field ) => field.slug !== attributes.metadata.slug
			);

			setMeta( {
				fields: JSON.stringify( newFields ),
			} );

			setAttributes( newAttributes );
		}, [ attributes.metadata, setAttributes, fields, setMeta ] );

		const selectedBlockType = getBlockType( name );

		const blockParentsByBlockName = getBlockParentsByBlockName(
			props.clientId,
			[ 'core/group' ]
		);

		// Check if any parent blocks have bindings.
		const parentHasBindings = useMemo( () => {
			return (
				getBlocksByClientId( blockParentsByBlockName ).filter(
					( block ) =>
						Object.keys(
							block?.attributes?.metadata?.[
								window.BINDINGS_KEY
							] || {}
						).length > 0
				).length > 0
			);
		}, [ blockParentsByBlockName, getBlocksByClientId ] );

		const supportedAttributes =
			SUPPORTED_BLOCK_ATTRIBUTES[ selectedBlockType?.name ];

		const setBinding = useCallback(
			( field ) => {
				const bindings = supportedAttributes.reduce(
					( acc, attribute ) => {
						acc[ attribute ] =
							'post_content' === field.slug
								? field.slug
								: `${ field.slug }__${ attribute }`;

						return acc;
					},
					{}
				);

				const newAttributes = {
					metadata: {
						...( attributes.metadata ?? {} ),
						[ window.BLOCK_VARIATION_NAME_ATTR ]: field.label,
						slug: field.slug,
						[ window.BINDINGS_KEY ]: bindings,
					},
				};

				setAttributes( newAttributes );
			},
			[ attributes.metadata, setAttributes, supportedAttributes ]
		);

		const validations = useMemo( () => {
			const metadata = attributes.metadata ?? {};
			const bindings = metadata[ window.BINDINGS_KEY ] ?? {};

			const _validations = {};

			const hasAtLeastOneBinding = Object.keys( bindings ).length > 0;

			if (
				hasAtLeastOneBinding &&
				! metadata[ window.BLOCK_VARIATION_NAME_ATTR ]
			) {
				_validations[ window.BLOCK_VARIATION_NAME_ATTR ] = (
					<ErrorMessage>
						{ __( 'Block variation name is required' ) }
					</ErrorMessage>
				);
			}

			if (
				metadata[ window.BLOCK_VARIATION_NAME_ATTR ] &&
				! hasAtLeastOneBinding
			) {
				_validations[ window.BLOCK_VARIATION_NAME_ATTR ] = (
					<ErrorMessage>
						{ __( 'Bind at least one attribute' ) }
					</ErrorMessage>
				);
			}

			Object.keys( bindings ).forEach( ( attribute ) => {
				const field = getBinding( attribute );

				if ( field === 'post_content' && name !== 'core/group' ) {
					_validations[ attribute ] = (
						<ErrorMessage>
							{ __(
								'Only Group blocks can be bound to post_content'
							) }
						</ErrorMessage>
					);
				}
			} );

			return _validations;
		}, [ attributes.metadata, getBinding, name ] );

		const bindings = attributes?.metadata?.[ window.BINDINGS_KEY ];
		const noInnerBlocks = getBlockOrder( props.clientId ).length === 0;

		const blockVariationName =
			props.attributes.metadata?.[ window.BLOCK_VARIATION_NAME_ATTR ];

		// Move this to data entry mode only?
		useEffect( () => {
			if ( 'core/group' === name && bindings && noInnerBlocks ) {
				replaceInnerBlocks( clientId, [
					createBlock( 'core/paragraph', {
						placeholder: sprintf(
							// translators: %s is the block name.
							__( 'Add the default blocks for %s' ),
							blockVariationName
						),
					} ),
				] );
			}
		}, [
			bindings,
			blockVariationName,
			noInnerBlocks,
			clientId,
			name,
			replaceInnerBlocks,
		] );

		useEffect( () => {
			const hasValidationErrors = Object.keys( validations ).length > 0;

			if ( hasValidationErrors ) {
				lockPostSaving();
			} else {
				unlockPostSaving();
			}
		}, [ lockPostSaving, unlockPostSaving, validations ] );

		if ( ! supportedAttributes || parentHasBindings ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<>
				<InspectorControls>
					<PanelBody title="Attribute Bindings" initialOpen>
						{ ! editingBoundAttribute && bindings && (
							<ItemGroup isBordered isSeparated>
								{ supportedAttributes.map( ( attribute ) => {
									return (
										<Item key={ attribute }>
											<Flex>
												<FlexBlock>
													{ attribute }
												</FlexBlock>
												{ bindings[ attribute ] && (
													<FlexItem>
														<span>
															<code>
																{
																	bindings[
																		attribute
																	]
																}
															</code>
														</span>
													</FlexItem>
												) }
											</Flex>
										</Item>
									);
								} ) }
							</ItemGroup>
						) }
						{ ! editingBoundAttribute && (
							<PanelRow>
								<ButtonGroup>
									<Button
										variant="secondary"
										onClick={ () =>
											setEditingBoundAttribute(
												window.BLOCK_VARIATION_NAME_ATTR
											)
										}
									>
										{ __( 'Manage Binding' ) }
									</Button>
									{ bindings && (
										<Button
											isDestructive
											onClick={ removeBindings }
										>
											{ __( 'Remove Binding' ) }
										</Button>
									) }
								</ButtonGroup>
							</PanelRow>
						) }
						{ editingBoundAttribute && (
							<PanelRow>
								<ManageBindings
									onSave={ ( formData ) => {
										setBinding( formData );
										setEditingBoundAttribute( null );
									} }
									defaultFormData={ {
										label:
											attributes?.metadata?.[
												window.BLOCK_VARIATION_NAME_ATTR
											] ?? '',
										slug: attributes?.metadata?.slug ?? '',
										uuid:
											boundField?.uuid ??
											window.crypto.randomUUID(),
										description: '',
										type: selectedBlockType?.name,
										visible: false,
									} }
									typeIsDisabled={ true }
								/>
							</PanelRow>
						) }
					</PanelBody>
				</InspectorControls>
				<BlockEdit { ...props } />
			</>
		);
	};
}, 'withAttributeBinder' );

addFilter(
	'editor.BlockEdit',
	'content-model/attribute-binder',
	withAttributeBinder
);
